package com.openiv.backend.cloudinary;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

/**
 * Thin async wrapper around the blocking Cloudinary Java SDK.
 * Every upload/delete runs on a Vert.x worker thread via executeBlocking so
 * the event loop is never blocked.
 */
public final class CloudinaryService {

  private static final Logger log = LoggerFactory.getLogger(CloudinaryService.class);

  private final Cloudinary cloudinary;
  private final Vertx      vertx;

  public CloudinaryService(Vertx vertx, String cloudName, String apiKey, String apiSecret) {
    this.vertx      = vertx;
    this.cloudinary = new Cloudinary(ObjectUtils.asMap(
        "cloud_name", cloudName,
        "api_key",    apiKey,
        "api_secret", apiSecret,
        "secure",     true
    ));
    log.info("[Cloudinary] Configured for cloud '{}'", cloudName);
  }

  /**
   * Upload raw bytes.  folder + publicId are combined into the Cloudinary
   * public_id (e.g. "openiv/42_abc123").
   *
   * @param resourceType "image", "raw", or "auto" (let Cloudinary decide)
   */
  public Future<UploadResult> upload(byte[] data, String folder, String publicId, String resourceType) {
    return vertx.executeBlocking(() -> {
      @SuppressWarnings("unchecked")
      Map<String, Object> result = (Map<String, Object>)
          cloudinary.uploader().upload(data, ObjectUtils.asMap(
              "folder",        folder,
              "public_id",     publicId,
              "resource_type", resourceType != null ? resourceType : "auto",
              "overwrite",     true
          ));
      int  w     = result.get("width")  instanceof Number n ? n.intValue()  : 0;
      int  h     = result.get("height") instanceof Number n ? n.intValue()  : 0;
      long bytes = result.get("bytes")  instanceof Number n ? n.longValue() : 0L;
      log.debug("[Cloudinary] Uploaded {} → {}", publicId, result.get("secure_url"));
      return new UploadResult(
          (String) result.get("public_id"),
          (String) result.get("secure_url"),
          (String) result.get("resource_type"),
          (String) result.get("format"),
          w, h, bytes
      );
    });
  }

  /** Delete a resource by its Cloudinary public_id. Failure is logged, not propagated. */
  public Future<Void> delete(String publicId, String resourceType) {
    return vertx.<Void>executeBlocking(() -> {
      cloudinary.uploader().destroy(publicId, ObjectUtils.asMap(
          "resource_type", resourceType != null ? resourceType : "image"
      ));
      return null;
    }).onFailure(e -> log.warn("[Cloudinary] Delete failed for {}: {}", publicId, e.getMessage()));
  }

  public record UploadResult(
      String publicId,
      String secureUrl,
      String resourceType,
      String format,
      int    width,
      int    height,
      long   bytes
  ) {}
}
