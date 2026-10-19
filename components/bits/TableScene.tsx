/* 圆桌 · 俯视图
   不画人物。画谁都会显丑——改成一张俯视的圆桌：
   一圈座位，其中两个之间连着一条红色虚线。
   那条虚线就是「悄悄话」：只有这两个座位知道同一件事。
   纯几何，怎么画都不会丑。 */

type Props = {
  className?: string;
  draw?: boolean;
};

const CX = 200;
const CY = 200;
const TABLE_R = 104;
const SEAT_R = 15;
const ORBIT = 152;

// 7 个座位；第 2 与第 5 座之间是那条悄悄话
const SEATS = [0, 1, 2, 3, 4, 5, 6].map((i) => {
  const a = (-90 + i * (360 / 7)) * (Math.PI / 180);
  return { i, x: CX + Math.cos(a) * ORBIT, y: CY + Math.sin(a) * ORBIT };
});
const WHISPER = [SEATS[1], SEATS[5]];

function whisperPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  // 从两座之间往圆心绕一道弧，像把话压低着递过去
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const pull = 0.62; // 往圆心收
  const cxp = CX + (mx - CX) * pull;
  const cyp = CY + (my - CY) * pull;
  return `M${a.x} ${a.y} Q${cxp} ${cyp} ${b.x} ${b.y}`;
}

export default function TableScene({ className, draw = false }: Props) {
  return (
    <svg
      className={"ts-scene" + (draw ? " ts-draw" : "") + (className ? " " + className : "")}
      viewBox="0 0 400 400"
      role="img"
      aria-label="圆桌俯视图：一圈座位，其中两个之间有一条私下的连线"
      fill="none"
    >
      {/* 桌沿：内外两圈 */}
      <g className="ts-table-line" stroke="currentColor" strokeWidth={2.2}>
        <circle cx={CX} cy={CY} r={TABLE_R} />
        <circle cx={CX} cy={CY} r={TABLE_R - 9} strokeWidth={1.2} opacity={0.55} />
      </g>

      {/* 桌面上的东西：茶碗、纸、笔 */}
      <g className="ts-things" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" opacity={0.75}>
        <path d={`M${CX - 34} ${CY - 18} q12 -8 24 0 l-4 8 h-16 z`} />
        <path d={`M${CX + 16} ${CY + 22} q11 -7 22 0 l-3 7 h-16 z`} />
        <path d={`M${CX - 16} ${CY + 34} h26`} />
        <path d={`M${CX + 4} ${CY + 42} l10 -5`} />
      </g>

      {/* 座位圈 */}
      <g className="ts-figures">
        {SEATS.map((s) => (
          <circle
            key={s.i}
            cx={s.x}
            cy={s.y}
            r={SEAT_R}
            fill="currentColor"
            opacity={WHISPER.some((w) => w.i === s.i) ? 1 : 0.34}
          />
        ))}
      </g>

      {/* 悄悄话：两座之间的红色虚线 */}
      <path
        className="ts-whisper"
        d={whisperPath(WHISPER[0], WHISPER[1])}
        stroke="var(--red)"
        strokeWidth={2.2}
        strokeDasharray="7 6"
        strokeLinecap="round"
      />
      {/* 一句低声的话 */}
      <g stroke="var(--red)" strokeWidth={2.2} strokeLinecap="round" opacity={0.9}>
        <path d={`M${CX - 26} ${CY - 52} q16 -9 32 0`} />
        <path d={`M${CX - 16} ${CY - 66} q12 -7 24 0`} />
      </g>
    </svg>
  );
}
