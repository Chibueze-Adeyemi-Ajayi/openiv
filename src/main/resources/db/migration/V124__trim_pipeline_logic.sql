UPDATE monitoring_pipelines SET logic = TRIM(logic) WHERE logic != TRIM(logic);
