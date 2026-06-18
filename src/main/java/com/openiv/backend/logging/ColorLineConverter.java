package com.openiv.backend.logging;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.pattern.CompositeConverter;

/**
 * Logback composite converter that wraps the composed sub-pattern in an
 * ANSI foreground color chosen by log level:
 *
 *   ERROR → red    (\033[31m)
 *   WARN  → yellow (\033[33m)
 *   INFO / DEBUG / TRACE → green (\033[32m)
 *
 * Register in logback.xml:
 *   <conversionRule conversionWord="colorLine"
 *                   converterClass="com.openiv.backend.logging.ColorLineConverter"/>
 *
 * Then use in a pattern:
 *   <pattern>%colorLine(%d %-5level [%thread] %logger{36} - %msg)%n</pattern>
 */
public final class ColorLineConverter extends CompositeConverter<ILoggingEvent> {

    private static final String RED    = "\033[31m";
    private static final String YELLOW = "\033[33m";
    private static final String GREEN  = "\033[32m";
    private static final String RESET  = "\033[0m";

    @Override
    protected String transform(ILoggingEvent event, String in) {
        // Strip trailing newline so RESET appears before it (avoids dangling color code on next line)
        String newline = "";
        if (in.endsWith("\n")) {
            in = in.substring(0, in.length() - 1);
            newline = "\n";
        }
        String sep = event.getLevel().isGreaterOrEqual(Level.WARN) ? "\n" : "";
        return sep + color(event.getLevel()) + in + RESET + newline;
    }

    private static String color(Level level) {
        if (level.isGreaterOrEqual(Level.ERROR)) return RED;
        if (level.isGreaterOrEqual(Level.WARN))  return YELLOW;
        return GREEN;
    }
}
