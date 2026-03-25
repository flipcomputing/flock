export function registerConditionGenerators(javascriptGenerator) {
  // -------------------------------
  // CONDITION
  // -------------------------------
  const MODE = { IF: "IF", ELSEIF: "ELSEIF", ELSE: "ELSE" };

  // If block ----------------------------------------------------
  javascriptGenerator.forBlock["if_clause"] = function (block, generator) {
    const isClause = (b) => b && b.type === "if_clause";

    const mode = block.getFieldValue("MODE");
    const prev = block.getPreviousBlock();

    // A new IF always starts a new chain, even if it follows another if_clause.
    const isChainTop = !isClause(prev) || mode === MODE.IF;

    // Non-top clauses do not emit code independently.
    if (!isChainTop) return "";

    // Collect this IF plus any following ELSEIF/ELSE clauses,
    // but stop before the next IF (that starts a new chain).
    const chain = [];
    let cur = block;

    while (cur && isClause(cur)) {
      chain.push(cur);

      const next = cur.getNextBlock();
      if (next && isClause(next) && next.getFieldValue("MODE") === MODE.IF)
        break;

      cur = next;
    }

    let code = "";

    const first = chain[0];
    const firstCond =
      generator.valueToCode(first, "COND", generator.ORDER_NONE) || "false";
    const firstBody = generator.statementToCode(first, "DO");

    code += `if (${firstCond}) {\n${firstBody}}`;

    for (let i = 1; i < chain.length; i++) {
      const clause = chain[i];
      const clauseMode = clause.getFieldValue("MODE");

      if (clauseMode === MODE.ELSEIF) {
        const cond =
          generator.valueToCode(clause, "COND", generator.ORDER_NONE) ||
          "false";
        const body = generator.statementToCode(clause, "DO");
        code += ` else if (${cond}) {\n${body}}`;
        continue;
      }

      if (clauseMode === MODE.ELSE) {
        const body = generator.statementToCode(clause, "DO");
        code += ` else {\n${body}}`;
        break;
      }

      // Defensive: if something weird slips through, stop.
      if (clauseMode === MODE.IF) break;
    }

    return code + "\n";
  };

  // The following blocks use default blockly generators
  // ---------------------------------------------------
  // Logical comparison
  // Not
  // Boolean true/false
  // Null
  // Ternary operator
}
