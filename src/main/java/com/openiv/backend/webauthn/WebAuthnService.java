package com.openiv.backend.webauthn;

import co.nstant.in.cbor.CborDecoder;
import co.nstant.in.cbor.CborException;
import co.nstant.in.cbor.model.ByteString;
import co.nstant.in.cbor.model.DataItem;
import co.nstant.in.cbor.model.NegativeInteger;
import co.nstant.in.cbor.model.UnicodeString;
import co.nstant.in.cbor.model.UnsignedInteger;
import com.openiv.backend.auth.crypto.Tokens;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.SessionState;
import com.openiv.backend.auth.repository.SessionRepository;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPublicKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

public class WebAuthnService {

  private final WebAuthnRepository repo;
  private final SessionRepository sessions;
  private final UserRepository users;
  private final Vertx vertx;
  private final String rpId;
  private final String rpOrigin;

  private static final long CHALLENGE_TTL_MS = 5 * 60 * 1000L;

  private record StoredChallenge(byte[] bytes, long expiresAt) {
    boolean isExpired() { return System.currentTimeMillis() > expiresAt; }
  }

  private record RegistrationData(byte[] credentialId, byte[] publicKeyDer,
                                   long signCount, String aaguid) {}

  private record VerificationResult(long credentialDbId, long newSignCount) {}

  // Challenge maps are per-user; challenges expire after 5 min.
  private final ConcurrentHashMap<Long, StoredChallenge> regChallenges  = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<Long, StoredChallenge> authChallenges = new ConcurrentHashMap<>();

  public WebAuthnService(WebAuthnRepository repo, SessionRepository sessions,
                          UserRepository users, Vertx vertx, String rpId, String rpOrigin) {
    this.repo     = repo;
    this.sessions = sessions;
    this.users    = users;
    this.vertx    = vertx;
    this.rpId     = rpId;
    this.rpOrigin = rpOrigin;
  }

  public Future<Boolean> isEnrolled(long userId) {
    return repo.countByUser(userId).map(count -> count > 0);
  }

  // ── Registration ──────────────────────────────────────────────────────────

  public Future<JsonObject> startRegistration(long userId, String displayName, String email) {
    byte[] challenge = randomBytes(32);
    pruneExpired();
    regChallenges.put(userId, new StoredChallenge(challenge,
        System.currentTimeMillis() + CHALLENGE_TTL_MS));

    return Future.succeededFuture(new JsonObject()
        .put("challenge", b64url(challenge))
        .put("rp", new JsonObject().put("name", "OpenIV").put("id", rpId))
        .put("user", new JsonObject()
            .put("id", b64url(longToBytes(userId)))
            .put("name", email)
            .put("displayName", displayName))
        .put("pubKeyCredParams", new JsonArray()
            .add(new JsonObject().put("type", "public-key").put("alg", -7))   // ES256 (ECDSA P-256) — preferred
            .add(new JsonObject().put("type", "public-key").put("alg", -257))) // RS256 (RSASSA-PKCS1-v1_5) — Windows Hello / Android fallback
        .put("authenticatorSelection", new JsonObject()
            .put("authenticatorAttachment", "platform")
            .put("userVerification", "required")
            .put("residentKey", "preferred"))
        .put("attestation", "none")
        .put("timeout", 60000));
  }

  public Future<Void> finishRegistration(Session session,
      String credentialIdB64, String clientDataJsonB64, String attestationObjectB64) {

    long userId = session.userId();
    StoredChallenge stored = regChallenges.remove(userId);
    if (stored == null || stored.isExpired())
      return Future.failedFuture(AuthException.invalid("webauthn_challenge_expired"));

    return vertx.<RegistrationData>executeBlocking(() -> {
      try {
        // 1. Verify clientDataJSON
        byte[] cdJsonBytes = decodeB64(clientDataJsonB64);
        JsonObject cd = new JsonObject(new String(cdJsonBytes, StandardCharsets.UTF_8));
        if (!"webauthn.create".equals(cd.getString("type")))
          throw AuthException.invalid("webauthn_type");
        if (!b64url(stored.bytes()).equals(cd.getString("challenge")))
          throw AuthException.invalid("webauthn_challenge");
        if (!rpOrigin.equals(cd.getString("origin")))
          throw AuthException.invalid("webauthn_origin");

        // 2. Decode attestationObject (CBOR)
        byte[] attObj = decodeB64(attestationObjectB64);
        List<DataItem> items = CborDecoder.decode(attObj);
        co.nstant.in.cbor.model.Map attMap = (co.nstant.in.cbor.model.Map) items.get(0);
        byte[] authData = ((ByteString) attMap.get(new UnicodeString("authData"))).getBytes();

        // 3. Verify rpIdHash (bytes 0–31)
        byte[] rpIdHash = Arrays.copyOfRange(authData, 0, 32);
        byte[] expected = MessageDigest.getInstance("SHA-256")
            .digest(rpId.getBytes(StandardCharsets.UTF_8));
        if (!Arrays.equals(rpIdHash, expected))
          throw AuthException.invalid("webauthn_rpid");

        // 4. Flags (byte 32): UP bit0, UV bit2, AT bit6
        byte flags = authData[32];
        if ((flags & 0x01) == 0) throw AuthException.invalid("webauthn_up");
        if ((flags & 0x04) == 0) throw AuthException.invalid("webauthn_uv");
        if ((flags & 0x40) == 0) throw AuthException.invalid("webauthn_no_cred");

        // 5. signCount (bytes 33–36, big-endian uint32)
        long signCount = u32(authData, 33);

        // 6. Attested credential data: AAGUID(16) + credIdLen(2) + credId + COSE key
        byte[] aaguid   = Arrays.copyOfRange(authData, 37, 53);
        int credIdLen   = ((authData[53] & 0xFF) << 8) | (authData[54] & 0xFF);
        byte[] credId   = Arrays.copyOfRange(authData, 55, 55 + credIdLen);
        byte[] coseBytes = Arrays.copyOfRange(authData, 55 + credIdLen, authData.length);

        // 7. Parse COSE key → Java PublicKey (ES256/EC or RS256/RSA)
        List<DataItem> coseItems = CborDecoder.decode(coseBytes);
        co.nstant.in.cbor.model.Map coseMap =
            (co.nstant.in.cbor.model.Map) coseItems.get(0);

        // COSE field 1 = kty: 2=EC2, 3=RSA
        DataItem ktyItem = coseGet(coseMap, 1);
        long kty = ktyItem instanceof UnsignedInteger u ? u.getValue().longValue() : -1L;

        PublicKey pub;
        if (kty == 3) {
          // RS256: n = field -1 (modulus), e = field -2 (exponent)
          byte[] n = ((ByteString) coseGet(coseMap, -1)).getBytes();
          byte[] e = ((ByteString) coseGet(coseMap, -2)).getBytes();
          pub = KeyFactory.getInstance("RSA")
              .generatePublic(new RSAPublicKeySpec(new BigInteger(1, n), new BigInteger(1, e)));
        } else {
          // ES256 (kty=2, P-256): x = field -2, y = field -3
          byte[] x = ((ByteString) coseGet(coseMap, -2)).getBytes();
          byte[] y = ((ByteString) coseGet(coseMap, -3)).getBytes();
          ECPoint point = new ECPoint(new BigInteger(1, x), new BigInteger(1, y));
          AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
          params.init(new ECGenParameterSpec("secp256r1"));
          ECParameterSpec ecSpec = params.getParameterSpec(ECParameterSpec.class);
          pub = KeyFactory.getInstance("EC")
              .generatePublic(new ECPublicKeySpec(point, ecSpec));
        }

        return new RegistrationData(credId, pub.getEncoded(), signCount, formatAaguid(aaguid));
      } catch (AuthException ae) {
        throw ae;
      } catch (CborException ce) {
        throw AuthException.invalid("webauthn_cbor");
      } catch (Exception e) {
        throw AuthException.invalid("webauthn_parse");
      }
    }).compose(data ->
        repo.save(userId, data.credentialId(), data.publicKeyDer(), data.signCount(), data.aaguid())
            .compose(v -> sessions.transitionState(session.id(), SessionState.AUTHENTICATED))
    );
  }

  // ── Authentication (step-up) ───────────────────────────────────────────────

  public Future<JsonObject> startAuthentication(long userId) {
    return repo.findByUserId(userId).map(creds -> {
      if (creds.isEmpty()) throw AuthException.invalid("webauthn_not_enrolled");

      byte[] challenge = randomBytes(32);
      pruneExpired();
      authChallenges.put(userId, new StoredChallenge(challenge,
          System.currentTimeMillis() + CHALLENGE_TTL_MS));

      JsonArray allow = new JsonArray();
      for (WebAuthnCredential c : creds)
        allow.add(new JsonObject().put("type", "public-key")
            .put("id", b64url(c.credentialId())));

      return new JsonObject()
          .put("challenge", b64url(challenge))
          .put("rpId", rpId)
          .put("allowCredentials", allow)
          .put("userVerification", "required")
          .put("timeout", 60000);
    });
  }

  public Future<Void> finishAuthentication(Session session,
      String credentialIdB64, String authenticatorDataB64,
      String clientDataJsonB64, String signatureB64) {

    long userId = session.userId();
    StoredChallenge stored = authChallenges.remove(userId);
    if (stored == null || stored.isExpired())
      return Future.failedFuture(AuthException.invalid("webauthn_challenge_expired"));

    byte[] credId = decodeB64(credentialIdB64);

    return repo.findByCredentialId(credId).compose(opt -> {
      WebAuthnCredential cred = opt.orElseThrow(
          () -> AuthException.invalid("webauthn_unknown_cred"));
      if (cred.userId() != userId)
        return Future.failedFuture(AuthException.invalid("webauthn_user_mismatch"));

      return vertx.<VerificationResult>executeBlocking(() -> {
        try {
          byte[] authData  = decodeB64(authenticatorDataB64);
          byte[] cdBytes   = decodeB64(clientDataJsonB64);
          byte[] signature = decodeB64(signatureB64);

          // Verify clientDataJSON
          JsonObject cd = new JsonObject(new String(cdBytes, StandardCharsets.UTF_8));
          if (!"webauthn.get".equals(cd.getString("type")))
            throw AuthException.invalid("webauthn_type");
          if (!b64url(stored.bytes()).equals(cd.getString("challenge")))
            throw AuthException.invalid("webauthn_challenge");
          if (!rpOrigin.equals(cd.getString("origin")))
            throw AuthException.invalid("webauthn_origin");

          // Verify rpIdHash
          byte[] rpIdHash = Arrays.copyOfRange(authData, 0, 32);
          byte[] expectedHash = MessageDigest.getInstance("SHA-256")
              .digest(rpId.getBytes(StandardCharsets.UTF_8));
          if (!Arrays.equals(rpIdHash, expectedHash))
            throw AuthException.invalid("webauthn_rpid");

          // Flags
          byte flags = authData[32];
          if ((flags & 0x01) == 0) throw AuthException.invalid("webauthn_up");
          if ((flags & 0x04) == 0) throw AuthException.invalid("webauthn_uv");

          long newSignCount = u32(authData, 33);

          // Verify signature: ES256 (SHA256withECDSA) or RS256 (SHA256withRSA)
          byte[] cdHash = MessageDigest.getInstance("SHA-256").digest(cdBytes);
          X509EncodedKeySpec keySpec = new X509EncodedKeySpec(cred.publicKeyDer());
          PublicKey pub;
          try {
            pub = KeyFactory.getInstance("EC").generatePublic(keySpec);
          } catch (Exception ex) {
            pub = KeyFactory.getInstance("RSA").generatePublic(keySpec);
          }
          Signature sig = pub instanceof java.security.interfaces.ECPublicKey
              ? Signature.getInstance("SHA256withECDSA")
              : Signature.getInstance("SHA256withRSA");
          sig.initVerify(pub);
          sig.update(authData);
          sig.update(cdHash);
          if (!sig.verify(signature)) throw AuthException.invalid("webauthn_signature");

          // Replay protection (skip if authenticator signals it doesn't track sign count)
          if (newSignCount != 0 && cred.signCount() != 0 && newSignCount <= cred.signCount())
            throw AuthException.invalid("webauthn_replay");

          return new VerificationResult(cred.id(), newSignCount);
        } catch (AuthException ae) {
          throw ae;
        } catch (Exception e) {
          throw AuthException.invalid("webauthn_verify");
        }
      }).compose(r -> repo.updateSignCount(r.credentialDbId(), r.newSignCount()));
    });
  }

  /** Login challenge variant: verify assertion then transition session → AUTHENTICATED. */
  public Future<Void> finishLoginChallenge(Session session,
      String credentialIdB64, String authenticatorDataB64,
      String clientDataJsonB64, String signatureB64) {
    return finishAuthentication(session, credentialIdB64, authenticatorDataB64,
        clientDataJsonB64, signatureB64)
        .compose(v -> sessions.transitionState(session.id(), SessionState.AUTHENTICATED));
  }

  // ── Unauthenticated biometric login ───────────────────────────────────────

  /**
   * Creates a PENDING_BIOMETRIC_CHALLENGE session for the given email and returns
   * assertion options. The raw token is returned so the handler can set the cookie.
   * Returns a generic error if user not found OR not enrolled (avoids enumeration).
   */
  public Future<JsonObject> loginStart(String email, String deviceId, String ip, String userAgent) {
    return users.findByEmail(email).compose(opt -> {
      if (opt.isEmpty())
        return Future.failedFuture(AuthException.invalid("biometric_login_unavailable"));
      var user = opt.get();
      return repo.countByUser(user.id()).compose(count -> {
        if (count == 0)
          return Future.failedFuture(AuthException.invalid("biometric_login_unavailable"));
        String token     = Tokens.generate();
        String tokenHash = Tokens.hash(token);
        return sessions.create(user.id(), tokenHash, SessionState.PENDING_BIOMETRIC_CHALLENGE,
            10, deviceId, ip, userAgent, null, null, null)
            .compose(session ->
                startAuthentication(user.id())
                    .map(options -> new JsonObject()
                        .put("_token", token)
                        .put("options", options)));
      });
    });
  }

  // ── Credential management (admin/CCO) ─────────────────────────────────────

  public Future<JsonArray> listMemberCredentials(Session session, long targetUserId) {
    return users.findById(session.userId()).compose(opt -> {
      var requester = opt.orElseThrow(() -> AuthException.security("user not found"));
      if (!"cco".equals(requester.role()) && !"admin".equals(requester.role()))
        return Future.failedFuture(AuthException.security("only CCO or admin can view credentials"));
      return users.findById(targetUserId).compose(tOpt -> {
        var target = tOpt.orElseThrow(() -> AuthException.security("member not found"));
        if (target.institutionId() != requester.institutionId())
          return Future.failedFuture(AuthException.security("member not in same institution"));
        return repo.findByUserId(targetUserId).map(creds -> {
          var arr = new JsonArray();
          for (var c : creds) {
            arr.add(new JsonObject()
                .put("id",          c.id())
                .put("aaguid",      c.aaguid())
                .put("createdAt",   c.createdAt()  != null ? c.createdAt().toString()  : null)
                .put("lastUsedAt",  c.lastUsedAt() != null ? c.lastUsedAt().toString() : null));
          }
          return arr;
        });
      });
    });
  }

  public Future<Void> revokeCredential(Session session, long targetUserId, long credDbId) {
    return users.findById(session.userId()).compose(opt -> {
      var requester = opt.orElseThrow(() -> AuthException.security("user not found"));
      if (!"cco".equals(requester.role()) && !"admin".equals(requester.role()))
        return Future.failedFuture(AuthException.security("only CCO or admin can revoke credentials"));
      return users.findById(targetUserId).compose(tOpt -> {
        var target = tOpt.orElseThrow(() -> AuthException.security("member not found"));
        if (target.institutionId() != requester.institutionId())
          return Future.failedFuture(AuthException.security("member not in same institution"));
        return repo.deleteById(credDbId, targetUserId);
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private DataItem coseGet(co.nstant.in.cbor.model.Map map, long key) {
    // Iterate explicitly; avoids relying on DataItem.equals() semantics across versions.
    for (DataItem k : map.getKeys()) {
      boolean match = key >= 0
          ? (k instanceof UnsignedInteger u && u.getValue().longValue() == key)
          : (k instanceof NegativeInteger n && n.getValue().longValue() == key);
      if (match) return map.get(k);
    }
    throw AuthException.invalid("webauthn_cose_key_" + key);
  }

  private byte[] decodeB64(String s) {
    if (s == null) throw AuthException.invalid("webauthn_missing_field");
    int pad = (4 - s.length() % 4) % 4;
    return Base64.getUrlDecoder().decode(s + "=".repeat(pad));
  }

  private String b64url(byte[] bytes) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private byte[] randomBytes(int len) {
    byte[] b = new byte[len];
    new SecureRandom().nextBytes(b);
    return b;
  }

  private byte[] longToBytes(long v) {
    byte[] b = new byte[8];
    for (int i = 7; i >= 0; i--) { b[i] = (byte)(v & 0xFF); v >>= 8; }
    return b;
  }

  private long u32(byte[] buf, int offset) {
    return ((long)(buf[offset] & 0xFF) << 24) | ((long)(buf[offset+1] & 0xFF) << 16)
        | ((long)(buf[offset+2] & 0xFF) << 8)  |  (buf[offset+3] & 0xFF);
  }

  private String formatAaguid(byte[] a) {
    StringBuilder sb = new StringBuilder(36);
    for (int i = 0; i < 16; i++) {
      if (i == 4 || i == 6 || i == 8 || i == 10) sb.append('-');
      sb.append(String.format("%02x", a[i] & 0xFF));
    }
    return sb.toString();
  }

  private void pruneExpired() {
    regChallenges.entrySet().removeIf(e  -> e.getValue().isExpired());
    authChallenges.entrySet().removeIf(e -> e.getValue().isExpired());
  }
}
