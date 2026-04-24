package com.openiv.backend.cases;

import com.openiv.backend.transactions.Transaction;
import java.util.List;

public record CaseDetail(
    CaseRecord         cas,
    List<Transaction>  transactions,
    List<CaseActivity> activity,
    List<CaseEvidence> evidence
) {}
