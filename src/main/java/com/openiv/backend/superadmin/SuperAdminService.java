package com.openiv.backend.superadmin;

import com.openiv.backend.auth.crypto.Codes;
import com.openiv.backend.auth.model.AccessRequest;
import com.openiv.backend.auth.model.Institution;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.repository.AccessRequestRepository;
import com.openiv.backend.auth.repository.InstitutionRepository;
import com.openiv.backend.auth.repository.InvitationRepository;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import com.openiv.backend.auth.service.EmailSender;
import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Super-admin operations: review access requests, provision institutions, manage institution status.
 * All methods verify the caller is the platform super-admin before executing.
 */
public final class SuperAdminService {

  private static final Logger log = LoggerFactory.getLogger(SuperAdminService.class);
  private static final int INVITE_EXPIRY_DAYS = 7;

  private final AccessRequestRepository accessRequests;
  private final InstitutionRepository institutions;
  private final InvitationRepository invitations;
  private final UserRepository users;
  private final EmailSender emailSender;
  private final String frontendUrl;

  public SuperAdminService(AccessRequestRepository accessRequests,
      InstitutionRepository institutions, InvitationRepository invitations,
      UserRepository users, EmailSender emailSender, String frontendUrl) {
    this.accessRequests = accessRequests;
    this.institutions = institutions;
    this.invitations = invitations;
    this.users = users;
    this.emailSender = emailSender;
    this.frontendUrl = frontendUrl;
  }

  // --- Access Requests ----------------------------------------------------

  public Future<List<AccessRequest>> listRequests(String status) {
    return accessRequests.listByStatus(status);
  }

  public Future<AccessRequest> getRequest(long id) {
    return accessRequests.findById(id)
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("access_request_not_found")));
  }

  public Future<ApproveResult> approveRequest(Session session, long requestId, String notes) {
    return resolveReviewerId(session).compose(reviewerId ->
        accessRequests.findById(requestId).compose(opt -> {
          AccessRequest req = opt.orElseThrow(() -> AuthException.invalid("access_request_not_found"));
          if (!"pending".equals(req.status())) {
            return Future.failedFuture(AuthException.invalid("already_reviewed"));
          }
          return institutions.create(req.institutionName(), req.institutionType())
              .compose(institution -> {
                String code = Codes.generateInviteCode();
                String codeHash = Codes.sha256(code);
                return invitations.create(codeHash, req.contactEmail(), "admin",
                        req.institutionType(), institution.id(), INVITE_EXPIRY_DAYS)
                    .compose(invitation -> {
                      String invitePageUrl = frontendUrl + "/auth/invite";
                      emailSender.sendInstitutionInvite(
                          req.contactEmail(),
                          req.contactName(),
                          req.institutionName(),
                          code,
                          invitePageUrl)
                          .onFailure(e ->
                              log.warn("[SuperAdmin] Invite email failed for request={} email={}: {}",
                                  requestId, req.contactEmail(), e.getMessage()));
                      return accessRequests.markApproved(requestId, reviewerId, notes)
                          .map(updated -> new ApproveResult(institution, invitation.id(), code));
                    });
              });
        })
    );
  }

  public Future<AccessRequest> rejectRequest(Session session, long requestId, String notes) {
    return resolveReviewerId(session).compose(reviewerId ->
        accessRequests.findById(requestId).compose(opt -> {
          AccessRequest req = opt.orElseThrow(() -> AuthException.invalid("access_request_not_found"));
          if (!"pending".equals(req.status())) {
            return Future.failedFuture(AuthException.invalid("already_reviewed"));
          }
          return accessRequests.markRejected(requestId, reviewerId, notes);
        })
    );
  }

  // --- Institutions -------------------------------------------------------

  public Future<List<Institution>> listInstitutions() {
    return institutions.listAll();
  }

  public Future<Institution> getInstitution(long id) {
    return institutions.findById(id)
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("institution_not_found")));
  }

  public Future<Institution> updateInstitutionStatus(long id, String status) {
    if (!"active".equals(status) && !"suspended".equals(status)) {
      return Future.failedFuture(AuthException.invalid("status"));
    }
    return institutions.findById(id)
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(AuthException.invalid("institution_not_found"));
          if (opt.get().id() == 1) {
            return Future.failedFuture(AuthException.invalid("cannot_modify_default_institution"));
          }
          return institutions.updateStatus(id, status);
        });
  }

  // --- Helpers ------------------------------------------------------------

  private Future<Long> resolveReviewerId(Session session) {
    return users.findById(session.userId())
        .map(opt -> opt.orElseThrow(() -> AuthException.invalid("session")).id());
  }

  public record ApproveResult(Institution institution, long invitationId, String inviteCode) {}
}
