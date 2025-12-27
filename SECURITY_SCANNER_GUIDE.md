# 🛡️ Security Vulnerability Scanner

## Overview

The Security Vulnerability Scanner is a powerful feature added to **What-The-Code** for detecting common security vulnerabilities in JavaScript and TypeScript codebases. It works in **both Privacy Mode and Public Mode**, providing comprehensive security analysis for your projects.

---

## Features

### 🔍 Static Analysis (Privacy Mode)
- **16 Vulnerability Types** detected using regex pattern matching
- **100% Local** - No external API calls required
- Detects issues like:
  - 🔑 Hardcoded secrets (API keys, passwords, tokens)
  - 💉 SQL injection vulnerabilities
  - 🌐 XSS (Cross-Site Scripting) vulnerabilities
  - ⚙️ Command injection risks
  - 📁 Path traversal vulnerabilities
  - 🎲 Insecure random number generation
  - 🔓 Weak cryptographic algorithms
  - ⚠️ Unsafe eval usage
  - 🧬 Prototype pollution
  - And more...

### 🎯 Severity Levels
- **Critical** 🔴 - Immediate action required
- **High** 🟠 - Should be fixed soon
- **Medium** 🟡 - Fix when possible
- **Low** 🔵 - Minor issues

### 📊 Dedicated Security Panel
- Tree view in the sidebar showing all security issues
- Organized by severity level
- Click-to-open functionality for each issue
- Rich tooltips with CWE/OWASP references

### 📋 HTML Security Reports
- Beautiful, comprehensive HTML reports
- Interactive charts and severity breakdown
- Detailed issue descriptions with recommendations
- CWE (Common Weakness Enumeration) IDs
- OWASP Top 10 category mappings
- Risk level assessment

---

## How to Use

### 1. **Run Security Scan**

#### Method 1: Using Command Palette
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type "Scan for Security Vulnerabilities"
3. Press Enter

#### Method 2: Using Keyboard Shortcut
- Press `Ctrl+Shift+Alt+S` (Windows/Linux)
- Press `Cmd+Shift+Alt+S` (Mac)

#### Method 3: Using Sidebar
1. Open the **What-The-Code** panel in the Activity Bar
2. Navigate to **🛡️ Security Scanner**
3. Click the shield icon in the panel header

### 2. **View Results**

After scanning, results appear in the **🛡️ Security Scanner** panel:

```
📊 Security Scan Summary
├── 🔴 Critical Issues (2)
│   ├── Hardcoded Secret at login.ts:45
│   └── SQL Injection at database.ts:102
├── 🟠 High Severity Issues (5)
│   ├── XSS Vulnerability at render.ts:78
│   └── ...
├── 🟡 Medium Severity Issues (3)
└── 🔵 Low Severity Issues (1)
```

### 3. **Open Issue Location**
- Click on any issue to jump to the exact file and line number
- The problematic code will be highlighted automatically

### 4. **Generate Security Report**

#### Using the Panel
1. Click the **📋 Generate Security Report** button in the Security Scanner panel

#### Using Command Palette
1. Press `Ctrl+Shift+P`
2. Type "Generate Security Report"
3. Press Enter

The report includes:
- Overall risk level assessment
- Issues grouped by severity
- Detailed descriptions and recommendations
- CWE/OWASP references
- Interactive charts

### 5. **Clear Results**
- Click the **Clear** icon in the Security Scanner panel to remove scan results

---

## Privacy Mode Support

The Security Scanner works **perfectly in Privacy Mode**:

✅ **Privacy Mode ON** (🔒):
- Uses static pattern matching (regex)
- No external API calls
- 100% local analysis
- Still detects all 16 vulnerability types

✅ **Privacy Mode OFF** (🌐):
- Same static analysis
- Future: AI-enhanced analysis with Gemini (planned)

**Note**: Currently, both modes use the same static analysis engine. AI-powered analysis is planned for a future release.

---

## Detected Vulnerability Types

| Icon | Type | CWE ID | Severity | OWASP Category |
|------|------|--------|----------|----------------|
| 🔑 | Hardcoded Secret | CWE-798 | Critical | A02:2021 - Cryptographic Failures |
| 💉 | SQL Injection | CWE-89 | Critical | A03:2021 - Injection |
| 🌐 | XSS Vulnerability | CWE-79 | High | A03:2021 - Injection |
| ⚙️ | Command Injection | CWE-78 | Critical | A03:2021 - Injection |
| 📁 | Path Traversal | CWE-22 | High | A01:2021 - Broken Access Control |
| ⚠️ | Unsafe Eval | CWE-95 | High | A03:2021 - Injection |
| 🎲 | Insecure Random | CWE-330 | Medium | A02:2021 - Cryptographic Failures |
| 🔓 | Weak Crypto | CWE-327 | High | A02:2021 - Cryptographic Failures |
| 🧬 | Prototype Pollution | CWE-1321 | High | A08:2021 - Software Integrity Failures |
| 📄 | XXE Vulnerability | CWE-611 | High | A05:2021 - Security Misconfiguration |
| ↗️ | Open Redirect | CWE-601 | Medium | A01:2021 - Broken Access Control |
| 📦 | Insecure Deserialization | CWE-502 | Critical | A08:2021 - Software Integrity Failures |
| 👁️ | Sensitive Data Exposure | CWE-200 | Medium | A02:2021 - Cryptographic Failures |
| 🌍 | CORS Misconfiguration | CWE-942 | Medium | A05:2021 - Security Misconfiguration |
| 🔀 | CSRF Vulnerability | CWE-352 | High | A01:2021 - Broken Access Control |
| ℹ️ | Information Disclosure | CWE-209 | Low | A04:2021 - Insecure Design |

---

## Example Security Report

When you generate a report, you'll get a beautiful HTML page with:

### 📊 Summary Dashboard
- Files scanned count
- Total issues found
- Scan duration
- Overall risk level (Critical/High/Medium/Low/Clean)

### 📈 Severity Breakdown
Visual cards showing:
- Critical issues count
- High severity issues
- Medium severity issues
- Low severity issues

### 🔍 Detailed Findings
For each issue:
- **Location**: File path, line number, column
- **Code Snippet**: The problematic code
- **Description**: What the issue is
- **Recommendation**: How to fix it
- **CWE ID**: Industry-standard weakness ID
- **OWASP Category**: OWASP Top 10 mapping

---

## File Structure

```
src/
├── securityScanner.ts            # Core scanning engine
├── securityActionsProvider.ts    # Tree view provider
├── securityReportGenerator.ts    # HTML report generator
└── types.ts                      # Security-related types
```

---

## Configuration

Currently, the Security Scanner works out-of-the-box with no configuration needed. It automatically:
- Scans all `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` files
- Filters out `node_modules`, `dist`, `build` directories
- Respects `.gitignore` patterns

---

## Best Practices

1. **Run regularly**: Scan your code before commits
2. **Fix critical issues first**: Start with red (critical) issues
3. **Review false positives**: Not all detections are true vulnerabilities
4. **Generate reports**: Keep HTML reports for documentation
5. **Test fixes**: Always test your code after fixing security issues

---

## Known Limitations

- **Static analysis only**: Currently uses pattern matching (AI analysis planned)
- **False positives possible**: May flag safe code that matches patterns
- **JavaScript/TypeScript only**: Other languages not yet supported
- **Context-aware analysis limited**: Can't understand complex data flows

---

## Future Enhancements (Planned)

- 🤖 AI-powered analysis with Gemini in Public Mode
- 🔧 Auto-fix suggestions for common vulnerabilities
- 📊 Security trend tracking over time
- 🌍 Support for more programming languages
- 🔗 Integration with CI/CD pipelines
- 📈 Security score calculation

---

## Troubleshooting

### No issues found but I know there are vulnerabilities
- The scanner uses pattern matching, which may not catch all issues
- Complex or obfuscated code might not be detected
- AI-powered analysis (coming soon) will help with this

### Too many false positives
- Review each issue carefully - the scanner prioritizes safety
- Comments or string literals might trigger false positives
- You can manually exclude specific patterns if needed

### Report won't open
- Check that you have a default browser set
- The report is saved in `.what-the-code-reports/` in your workspace
- You can open it manually from the file explorer

---

## Support

For issues, feature requests, or questions:
- GitHub Issues: https://github.com/insaneodyssey26/what-the-code/issues
- Email: [Your contact email]

---

## Credits

Security patterns based on:
- OWASP Top 10 (2021)
- CWE (Common Weakness Enumeration)
- Industry best practices

---

**Stay secure! 🛡️**
