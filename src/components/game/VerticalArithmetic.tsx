/**
 * v0.31.73：竖式数字结构化渲染。
 *
 * 用 CSS grid 按数位对齐，避免 ASCII art 在 variable-width 字体下错位。
 *
 * 用法：
 *   <VerticalArithmetic a="5.09" op="−" b="2.30" />
 *   <VerticalArithmetic a="5.09" op="−" b="2.3" align="right" />   ← 末位对齐
 *
 * 默认按小数点对齐。当 align="right" 时按末位对齐（演示错误对齐用）。
 */

interface Props {
  /** 第一个操作数（顶行） */
  a: string;
  /** 运算符 + - × ÷ */
  op: string;
  /** 第二个操作数（第二行） */
  b: string;
  /** 对齐方式：decimal (按小数点) / right (按末位) */
  align?: "decimal" | "right";
  /** 是否显示横线 */
  showLine?: boolean;
  /** 紧凑 / 大字模式（option 卡里用 normal，hero 题面用 large） */
  size?: "normal" | "large";
}

export function VerticalArithmetic({
  a,
  op,
  b,
  align = "decimal",
  showLine = true,
  size = "normal",
}: Props) {
  // Pad numbers based on alignment
  const { aPadded, bPadded, totalCols } = padForAlign(a, b, align);
  const rowHeight = size === "large" ? "h-9" : "h-7";
  const fontSize = size === "large" ? "text-2xl" : "text-base";

  return (
    <div className={`inline-block font-mono ${fontSize} text-slate-100 leading-tight`}>
      <div className="flex flex-col items-end gap-0.5">
        {/* row 1: a (no operator) */}
        <Row chars={aPadded} totalCols={totalCols} rowHeight={rowHeight} />
        {/* row 2: op + b */}
        <Row chars={bPadded} totalCols={totalCols} rowHeight={rowHeight} prefix={op} />
        {/* horizontal line */}
        {showLine && (
          <div
            className="w-full border-b-2 border-slate-300"
            style={{ width: `calc(${totalCols} * 0.6em + 1.4em)` }}
          />
        )}
      </div>
    </div>
  );
}

function Row({
  chars,
  totalCols,
  rowHeight,
  prefix,
}: {
  chars: string[];
  totalCols: number;
  rowHeight: string;
  prefix?: string;
}) {
  return (
    <div className={`flex items-center ${rowHeight}`}>
      <span className="w-6 text-right pr-1 text-slate-300">{prefix ?? ""}</span>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${totalCols}, 0.6em)`,
          textAlign: "center",
        }}
      >
        {chars.map((c, i) => (
          <span key={i} className={c === "." ? "text-amber-300" : ""}>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Decimal-aware padding so two numbers align by decimal point.
 * "5.09" + "2.3" with decimal-align → ["5",".","0","9"] + [" ","2",".","3"," "]
 * "5.09" + "2.3" with right-align    → ["5",".","0","9"] + [" "," ","2",".","3"]
 *
 * 返回每个数的 char 数组（含点位置）+ 总列数，让 Row 用 grid 等宽渲染。
 */
function padForAlign(a: string, b: string, align: "decimal" | "right") {
  if (align === "decimal") {
    const [aInt, aDec = ""] = a.split(".");
    const [bInt, bDec = ""] = b.split(".");
    const intLen = Math.max(aInt!.length, bInt!.length);
    const decLen = Math.max(aDec.length, bDec.length);
    const totalCols = intLen + (decLen > 0 ? 1 + decLen : 0);
    const buildRow = (intPart: string, decPart: string): string[] => {
      const intPad = " ".repeat(intLen - intPart.length);
      const decPad = decPart.length < decLen ? "" : ""; // we render exact, no trailing pad
      const row: string[] = [];
      for (const c of intPad) row.push(c);
      for (const c of intPart) row.push(c);
      if (decLen > 0) {
        // 即使 a/b 没有小数部分，也要占位（让点位对齐）
        if (decPart.length > 0) {
          row.push(".");
          for (const c of decPart) row.push(c);
          // 补尾部空位
          for (let i = decPart.length; i < decLen; i++) row.push(" ");
        } else {
          row.push(" "); // 占小数点位
          for (let i = 0; i < decLen; i++) row.push(" ");
        }
        void decPad;
      }
      return row;
    };
    return {
      aPadded: buildRow(aInt!, aDec),
      bPadded: buildRow(bInt!, bDec),
      totalCols,
    };
  }
  // right-align：仅按末位对齐，跨小数点（错位演示）
  const aLen = a.length;
  const bLen = b.length;
  const totalCols = Math.max(aLen, bLen);
  const buildRight = (s: string): string[] => {
    const pad = " ".repeat(totalCols - s.length);
    return [...pad, ...s.split("")];
  };
  return {
    aPadded: buildRight(a),
    bPadded: buildRight(b),
    totalCols,
  };
}
