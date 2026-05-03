package com.openiv.backend.customers;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.AuthException;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

public final class CustomerHandlers {
  private final CustomerService service;
  private final UserRepository users;

  public CustomerHandlers(CustomerService service, UserRepository users) {
    this.service = service;
    this.users = users;
  }

  public Handler<RoutingContext> getCustomer() {
    return ctx -> {
      Session session = SessionAuthHandler.require(ctx);
      String externalId = ctx.pathParam("id");

      users.findById(session.userId())
          .compose(uOpt -> {
            User u = uOpt.orElseThrow(() -> AuthException.invalid("session"));
            return service.getCustomer(u.institutionId(), externalId);
          })
          .onSuccess(cOpt -> {
            if (cOpt.isEmpty()) {
              ctx.response().setStatusCode(404).end(new JsonObject().put("error", "Customer not found").encode());
            } else {
              ctx.response()
                  .setStatusCode(200)
                  .putHeader("Content-Type", "application/json")
                  .end(toJson(cOpt.get()).encode());
            }
          })
          .onFailure(ctx::fail);
    };
  }

  private static JsonObject toJson(Customer c) {
    return new JsonObject()
        .put("id", c.id())
        .put("institutionId", c.institutionId())
        .put("externalId", c.externalId())
        .put("name", c.name())
        .put("email", c.email())
        .put("phone", c.phone())
        .put("riskScore", c.riskScore())
        .put("createdAt", c.createdAt().toString())
        .put("updatedAt", c.updatedAt().toString());
  }
}
