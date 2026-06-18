package com.openiv.backend.logging;

import ch.qos.logback.classic.PatternLayout;

/**
 * Backup registration of %colorLine in PatternLayout's shared DEFAULT_CONVERTER_MAP.
 * Primary registration is via <conversionRule> in logback.xml (required for
 * PatternLayoutEncoder used by ConsoleAppender in Logback 1.3+).
 */
public final class ColorPatternLayout extends PatternLayout {
    static {
        DEFAULT_CONVERTER_MAP.put("colorLine", ColorLineConverter.class.getName());
    }
}
