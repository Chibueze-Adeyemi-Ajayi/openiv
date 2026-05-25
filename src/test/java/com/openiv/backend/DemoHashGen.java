package com.openiv.backend;

import com.openiv.backend.auth.crypto.PasswordHasher;

public class DemoHashGen {
    public static void main(String[] args) {
        String[] passwords = {"VantageDemo2026!", "Analyst@2026!", "Auditor@2026!"};
        for (String pw : passwords) {
            System.out.println(pw + " => " + PasswordHasher.hash(pw));
        }
    }
}
