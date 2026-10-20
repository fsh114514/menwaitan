/* 圆桌 · 俯视图（空状态专用）
   不画人物——只画一张桌子、几个座位，和**一把空着的椅子**。
   空着的那把会呼吸，意思很直白：这里还缺你一个。
   纯几何，在小尺寸下也不会糊。 */

type Props = {
  className?: string;
  /** 开启入场动画：座位逐个亮起，空位持续呼吸，悄悄话的虚线流动 */
  draw?: boolean;
};

const CX = 200;
const CY = 200;
const TABLE_R = 108;
const SEAT_R = 16;
const ORBIT = 158;
const N = 7;

const SEATS = Array.from({ length: N }, (_, i) => {
  const a = (-90 + i * (360 / N)) * (Math.PI / 180);
  return { i, x: CX + Math.cos(a) * ORBIT, y: CY + Math.sin(a) * ORBIT };
});

// 空着的那把 —— 左下角，靠近读者
const EMPTY = 4;
// 悄悄话的两端
const WHISPER = [SEATS[1], SEATS[5]];

function whisperPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const pull = 0.5;
  return `M${a.x} ${a.y} Q${CX + (mx - CX) * pull} ${CY + (my - CY) * pull} ${b.x} ${b.y}`;
}

export default function TableScene({ className, draw = false }: Props) {
  const seat = SEATS[EMPTY];
  return (
    <svg
      className={"ts-scene" + (draw ? " ts-draw" : "") + (className ? " " + className : "")}
      viewBox="0 0 400 400"
      role="img"
      aria-label={`圆桌俯视图：${N - 1} 人已入席，还空着一把椅子`}
      fill="none"
    >
      {/* 桌沿：外圈实、内圈虚 */}
      <g className="ts-table-line" stroke="currentColor" strokeWidth={2.4}>
        <circle cx={CX} cy={CY} r={TABLE_R} />
        <circle cx={CX} cy={CY} r={TABLE_R - 11} strokeWidth={1} opacity={0.4} />
      </g>

      {/* 桌上的东西：两个茶碗、一张纸、一支笔 */}
      <g className="ts-things" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" opacity={0.62}>
        <path d={`M${CX - 40} ${CY - 22} q13 -9 26 0 l-4 9 h-18 z`} />
        <path d={`M${CX + 18} ${CY + 24} q12 -8 24 0 l-4 8 h-16 z`} />
        <path d={`M${CX - 18} ${CY + 36} h28`} />
        <path d={`M${CX + 2} ${CY + 44} l11 -5`} />
        <path d={`M${CX - 6} ${CY - 44} q9 -11 22 -8`} stroke="var(--red)" opacity={0.8} />
      </g>

      {/* 已入席的座位 */}
      <g className="ts-figures">
        {SEATS.map((s, k) =>
          s.i === EMPTY ? null : (
            <circle
              key={s.i}
              className="ts-seat"
              cx={s.x}
              cy={s.y}
              r={SEAT_R}
              fill="currentColor"
              opacity={WHISPER.some((w) => w.i === s.i) ? 0.92 : 0.4}
              style={draw ? { animationDelay: `${0.08 * k}s` } : undefined}
            />
          )
        )}
      </g>

      {/* 悄悄话：两座之间的红色虚线，会缓缓流动 */}
      <path
        className="ts-whisper"
        d={whisperPath(WHISPER[0], WHISPER[1])}
        stroke="var(--red)"
        strokeWidth={2.2}
        strokeDasharray="8 7"
        strokeLinecap="round"
        opacity={0.85}
      />

      {/* 空着的那把：虚线圆 + 向外扩散的圈 */}
      <g className="ts-empty-seat">
        {draw && <circle cx={seat.x} cy={seat.y} r={SEAT_R} className="ts-seat-pulse" fill="none" stroke="var(--red)" strokeWidth={1.6} />}
        <circle cx={seat.x} cy={seat.y} r={SEAT_R} fill="none" stroke="var(--red)" strokeWidth={2} strokeDasharray="4 4" opacity={0.9} />
      </g>
    </svg>
  );
}
