# ==========================================
# Stage 1: Build Environment (Maven + JDK 21)
# ==========================================
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder

WORKDIR /app

# Copy pom.xml first to download dependencies and leverage Docker layer caching
COPY pom.xml ./
RUN mvn dependency:go-offline -B

# Copy the source code
COPY src ./src

# Package the application as a fat JAR, skipping tests for build speed
RUN mvn package -DskipTests

# ==========================================
# Stage 2: Runtime Environment (JRE 21)
# ==========================================
FROM eclipse-temurin:21-jre-alpine AS runner

# Create a secure non-root group and user
RUN addgroup -S openiv && adduser -S openiv -G openiv

WORKDIR /app

# Pre-create required runtime folders and assign permissions to the non-root user
RUN mkdir -p config file-uploads logs && chown -R openiv:openiv /app

# Switch context to the secure non-root user
USER openiv

# Copy the built fat JAR from the builder stage
COPY --from=builder --chown=openiv:openiv /app/target/openiv-backend-*-fat.jar ./app.jar

# Copy the example config to serve as documentation or a fallback reference within the image
COPY --chown=openiv:openiv config/application.json.example ./config/application.json.example

# Expose the default HTTP service port
EXPOSE 8081

# Configure default JVM options and environment variables
ENV PORT=8081 \
    JAVA_OPTS="-XX:+ShowCodeDetailsInExceptionMessages -Dfile.encoding=UTF-8"

# Launch the Vert.x application resolving the port dynamically for local and production compatibility
CMD ["sh", "-c", "export OPENIV_HTTP_PORT=${OPENIV_HTTP_PORT:-${PORT:-8081}} && java $JAVA_OPTS -jar app.jar"]
