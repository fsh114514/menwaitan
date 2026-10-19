/* 三人围桌 · 实心剪影
   之前是线描人脸，五官一歪就显丑。改成剪影：只留轮廓，不画脸。
   这是老报纸插图最常见的处理，也最不容易画坏。 */

type Props = {
  className?: string;
  draw?: boolean;
};

const TABLE_Y = 272;

function figure(cx: number, headY: number, r: number, halfW: number) {
  const neckY = headY + r + 6;   // 脖子与肩的接缝
  const bodyTop = headY + r - 2;
  return (
    <g key={cx}>
      <circle cx={cx} cy={headY} r={r} />
      <path
        d={
          `M${cx - halfW} ${TABLE_Y} ` +
          `C${cx - halfW + 2} ${neckY + 54} ${cx - 26} ${neckY + 22} ${cx - 11} ${neckY} ` +
          `L${cx - 11} ${bodyTop} L${cx + 11} ${bodyTop} L${cx + 11} ${neckY} ` +
          `C${cx + 26} ${neckY + 22} ${cx + halfW - 2} ${neckY + 54} ${cx + halfW} ${TABLE_Y} Z`
        }
      />
    </g>
  );
}

export default function TableScene({ className, draw = false }: Props) {
  return (
    <svg
      className={"ts-scene" + (draw ? " ts-draw" : "") + (className ? " " + className : "")}
      viewBox="0 0 480 340"
      role="img"
      aria-label="三位人物围坐桌旁对谈"
      fill="none"
    >
      <g className="ts-figures" fill="currentColor" stroke="none">
        {figure(120, 150, 23, 52)}
        {figure(240, 140, 24, 56)}
        {figure(360, 158, 21, 48)}
        {/* 中间那位的帽檐 */}
        <rect x={240 - 30} y={140 - 24 - 5} width={60} height={5} rx={2.5} />
      </g>

      {/* 桌子：填底色遮住下半身，再描边 */}
      <path
        d={`M22 ${TABLE_Y} a218 46 0 1 0 436 0 a218 46 0 1 0 -436 0 z`}
        fill="var(--card)"
        stroke="none"
      />
      <g className="ts-table-line" stroke="currentColor" strokeWidth={2.4} fill="none" strokeLinecap="round">
        <ellipse cx="240" cy={TABLE_Y} rx="218" ry="46" />
        <path d={`M22 ${TABLE_Y} q14 46 218 46 q204 0 218 -46`} />
      </g>

      <g className="ts-things" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
        <path d="M150 262 q13-9 26 0 l-4 9 h-18 z" />
        <path d="M304 260 q13-9 26 0 l-4 9 h-18 z" />
        <path d="M228 280 h24" />
        <path d="M276 276 l14 -6" />
      </g>

      <g fill="none" stroke="var(--red)" strokeWidth={2.4} strokeLinecap="round">
        <path d="M74 96 q16-10 32 0" />
        <path d="M86 118 q14-9 28 0" />
        <path d="M376 106 q16-10 32 0" />
      </g>
    </svg>
  );
}
