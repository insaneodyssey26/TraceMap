# 📊 Complexity Score Calculation

## Overview

The **Complexity Score** (0-100) is a comprehensive metric that combines multiple complexity factors to give you an overall assessment of how complex your code is. Higher scores indicate more complex code that may be harder to maintain.

## Score Breakdown

The complexity score ranges from **0 to 100** and is calculated using this formula:

```
Complexity Score = min(100, 
    Cyclomatic Contribution + 
    Cognitive Contribution + 
    Nesting Contribution + 
    LOC Contribution + 
    Maintainability Penalty
)
```

### 1. **Cyclomatic Complexity Contribution** (0-30 points)
```
Contribution = min(30, Average Cyclomatic Complexity × 2)
```

**What it measures:** The number of independent paths through your code (decision points).

**Counted elements:**
- `if`, `else if` statements
- `for`, `while`, `do-while` loops
- `switch` cases
- Ternary operators (`? :`)
- Logical operators (`&&`, `||`)
- `catch` blocks
- `break`, `continue` statements

**Example:**
```typescript
function validateUser(user) {           // +1 (base complexity)
    if (!user) {                        // +1
        return false;
    }
    
    if (!user.name || !user.email) {    // +1 for if, +1 for ||
        return false;
    }
    
    for (let role of user.roles) {      // +1
        if (role === 'admin') {         // +1
            return true;
        }
    }
    
    return false;
}
// Cyclomatic Complexity = 6
// Contribution = min(30, 6 × 2) = 12 points
```

---

### 2. **Cognitive Complexity Contribution** (0-30 points)
```
Contribution = min(30, Average Cognitive Complexity × 1.5)
```

**What it measures:** How difficult the code is to understand, accounting for nesting levels.

**Key difference from cyclomatic:** Cognitive complexity increases more for nested structures.

**Nesting penalty:** Each level of nesting adds extra points
- Level 1 (no nesting): +1 per decision
- Level 2 (1 level deep): +2 per decision
- Level 3 (2 levels deep): +3 per decision
- And so on...

**Example:**
```typescript
function processOrders(orders) {
    for (let order of orders) {                    // +1 (level 1)
        if (order.status === 'pending') {          // +2 (level 2)
            for (let item of order.items) {        // +3 (level 3)
                if (item.quantity > 0) {           // +4 (level 4)
                    calculatePrice(item);
                }
            }
        }
    }
}
// Cognitive Complexity = 1 + 2 + 3 + 4 = 10
// Contribution = min(30, 10 × 1.5) = 15 points
```

---

### 3. **Nesting Depth Contribution** (0-20 points)
```
Contribution = min(20, Max Nesting Depth × 3)
```

**What it measures:** The maximum depth of nested braces `{}` in your code.

**Why it matters:** Deep nesting makes code harder to read and reason about.

**Example:**
```typescript
function example() {                    // Depth 1
    if (condition1) {                   // Depth 2
        while (condition2) {            // Depth 3
            for (let i = 0; i < 10; i++) {  // Depth 4
                if (condition3) {       // Depth 5
                    // code here
                }
            }
        }
    }
}
// Max Depth = 5
// Contribution = min(20, 5 × 3) = 15 points
```

---

### 4. **Lines of Code Contribution** (0-10 points)
```
Contribution = min(10, Total Lines / 50)
```

**What it measures:** The size of your code file.

**Why it matters:** Longer files are generally harder to understand and maintain.

**Example:**
```
File with 250 lines of code:
Contribution = min(10, 250 / 50) = min(10, 5) = 5 points

File with 600 lines of code:
Contribution = min(10, 600 / 50) = min(10, 12) = 10 points
```

---

### 5. **Maintainability Index Penalty** (0-10 points)
```
Penalty = (100 - Maintainability Index) / 10
```

**What it measures:** Uses Microsoft's Maintainability Index formula (inverted).

**Maintainability Index formula:**
```
MI = MAX(0, (171 - 5.2 × ln(HV) - 0.23 × CC - 16.2 × ln(LOC)) × 100 / 171)
```
Where:
- HV = Halstead Volume (code vocabulary complexity)
- CC = Average Cyclomatic Complexity
- LOC = Lines of Code

**Why it matters:** Lower maintainability means the code is harder to change safely.

**Example:**
```
Maintainability Index = 65
Penalty = (100 - 65) / 10 = 3.5 points
```

---

## 🎯 Complexity Score Ranges

### 🟢 **Low Complexity (0-39)**
- **Excellent!** Code is clean, simple, and easy to maintain
- Few decision points
- Minimal nesting
- High maintainability
- Recommended for all code

### 🟡 **Medium Complexity (40-70)**
- **Moderate.** Code is somewhat complex but manageable
- Consider refactoring if approaching 70
- May benefit from breaking into smaller functions
- Review for potential simplifications

### 🔴 **High Complexity (71-100)**
- **Warning!** Code is complex and may be difficult to maintain
- High risk of bugs
- Difficult to test thoroughly
- **Strongly recommended to refactor**
- Consider:
  - Breaking into smaller functions
  - Reducing nesting levels
  - Simplifying logic
  - Using early returns
  - Extracting complex conditions

---

## 📊 Real-World Examples

### Example 1: Simple Function
```typescript
function greet(name: string): string {
    return `Hello, ${name}!`;
}
```
- Cyclomatic: 1 → Contribution: 2
- Cognitive: 0 → Contribution: 0
- Nesting: 1 → Contribution: 3
- LOC: 3 → Contribution: 0.06
- MI: ~95 → Penalty: 0.5
- **Total: ~5.56/100** 🟢

---

### Example 2: Moderate Function
```typescript
function calculateDiscount(price: number, userType: string): number {
    if (userType === 'premium') {
        if (price > 100) {
            return price * 0.20;
        } else {
            return price * 0.10;
        }
    } else if (userType === 'regular') {
        if (price > 100) {
            return price * 0.10;
        }
    }
    return 0;
}
```
- Cyclomatic: 5 → Contribution: 10
- Cognitive: 7 → Contribution: 10.5
- Nesting: 3 → Contribution: 9
- LOC: 14 → Contribution: 0.28
- MI: ~70 → Penalty: 3
- **Total: ~32.78/100** 🟢

---

### Example 3: Complex Function
```typescript
function processData(data: any[]): any[] {
    const results = [];
    for (let i = 0; i < data.length; i++) {
        if (data[i].type === 'user') {
            if (data[i].status === 'active') {
                for (let j = 0; j < data[i].permissions.length; j++) {
                    if (data[i].permissions[j].level > 5) {
                        if (data[i].permissions[j].validated) {
                            results.push({
                                id: data[i].id,
                                permission: data[i].permissions[j]
                            });
                        }
                    }
                }
            } else if (data[i].status === 'pending') {
                if (data[i].verificationSent) {
                    results.push({ id: data[i].id, status: 'awaiting' });
                }
            }
        }
    }
    return results;
}
```
- Cyclomatic: 8 → Contribution: 16
- Cognitive: 22 → Contribution: 30 (capped)
- Nesting: 6 → Contribution: 18
- LOC: 24 → Contribution: 0.48
- MI: ~45 → Penalty: 5.5
- **Total: ~70/100** 🟡 (Approaching high complexity!)

---

## 🛠️ How to Reduce Complexity

### 1. **Use Early Returns**
❌ Before:
```typescript
function validate(user) {
    if (user) {
        if (user.email) {
            if (user.verified) {
                return true;
            }
        }
    }
    return false;
}
```

✅ After:
```typescript
function validate(user) {
    if (!user) return false;
    if (!user.email) return false;
    if (!user.verified) return false;
    return true;
}
```

### 2. **Extract Methods**
❌ Before: One large function with cyclomatic complexity of 15

✅ After: Five smaller functions with complexity of 3 each

### 3. **Use Table/Map Lookups**
❌ Before: Long if-else chains

✅ After: Object/Map lookup

### 4. **Simplify Boolean Logic**
❌ Before:
```typescript
if (a && b || c && d || e && !f) { ... }
```

✅ After:
```typescript
const condition1 = a && b;
const condition2 = c && d;
const condition3 = e && !f;
if (condition1 || condition2 || condition3) { ... }
```

---

## 📈 Using the Complexity Analysis

1. **Analyze Your Workspace**: Run the "🔍 Analyze Complexity" command
2. **Review the Tree View**: See files sorted by complexity score
3. **Check the Heatmap**: Generate visual report with "📊 Generate Complexity Heatmap"
4. **Focus on High Scores**: Prioritize refactoring files with scores > 70
5. **Monitor Over Time**: Track improvements after refactoring

---

## 🎯 Target Goals

- **Overall Codebase**: Average < 40
- **Individual Files**: < 70 (refactor anything higher)
- **Critical Functions**: < 10 cyclomatic complexity
- **Nesting Depth**: < 4 levels

---

*Remember: These are guidelines, not absolute rules. Context matters, but complexity scores provide valuable insights into code maintainability.*
