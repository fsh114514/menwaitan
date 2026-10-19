/* 三人围桌 · 线描插画
   民国报刊线描的语汇：单色墨线 + 一笔红，不填色、不描阴影。
   用于首屏与「请人入席」空状态。 */

type Props = {
  className?: string;
  /** 是否开启动笔动画（空状态用） */
  draw?: boolean;
};

const P1 = { cx: 120, hy: 128, rx: 20, ry: 23, w: 52 };
const P2 = { cx: 240, hy: 120, rx: 20, ry: 23, w: 54 };
const P3 = { cx: 360, hy: 136, rx: 19, ry: 22, w: 50 };
const TABLE_Y = 268;

function person({ cx, hy, rx, ry, w }: typeof P1) {
  const hl = hy + ry;      // 头底
  const nl = hl + 16;      // 脖子底
  const l = cx - 11;
  const r = cx + 11;
  return (
    <g key={cx}>
      <ellipse cx={cx} cy={hy} rx={rx} ry={ry} />
      <path d={`M${l} ${hl} v16 M${r} ${hl} v16`} />
      <path d={`M${cx - w} ${TABLE_Y} C${cx - w + 2} ${nl + 42} ${cx - 34} ${nl + 14} ${l} ${nl}`} />
      <path d={`M${cx + w} ${TABLE_Y} C${cx + w - 2} ${nl + 42} ${cx + 34} ${nl + 14} ${r} ${nl}`} />
      <path d={`M${cx - 13} ${nl + 6} L${cx} ${nl + 26} L${cx + 13} ${nl + 6}`} />
    </g>
  );
}

export default function TableScene({ className, draw = false }: Props) {
  const anim = draw ? " ts-draw" : "";
  return (
    <svg
      className={"ts-scene" + anim + (className ? " " + className : "")}
      viewBox="0 0 480 340"
      role="img"
      aria-label="三位人物围坐桌旁对谈"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g className="ts-figures">
        {person(P1)}
        <path d="M103 110 C110 96 130 96 137 110" />
        {person(P2)}
        <path d="M213 88 h54" />
        <path d="M219 88 C224 68 256 68 261 88" />
        {person(P3)}
        <path d="M345 118 C352 106 368 106 375 118" />
      </g>

      {/* 桌子：先填纸色遮住下半身，再描边 */}
      <path
        className="ts-table"
        d={`M22 ${TABLE_Y} a218 46 0 1 0 436 0 a218 46 0 1 0 -436 0 z`}
        fill="var(--card)"
        stroke="none"
      />
      <g className="ts-table-line">
        <ellipse cx="240" cy={TABLE_Y} rx="218" ry="46" />
        <path d={`M22 ${TABLE_Y} q14 46 218 46 q204 0 218 -46`} />
      </g>

      <g className="ts-things" strokeWidth={2.2}>
        <path d="M150 258 q13-9 26 0 l-4 9 h-18 z" />
        <path d="M304 256 q13-9 26 0 l-4 9 h-18 z" />
        <path d="M228 276 h24" />
        <path d="M276 272 l14 -6" />
      </g>

      <g className="ts-red" stroke="var(--red)" strokeWidth={2.2}>
        <path d="M78 96 q14-8 28 0" />
        <path d="M390 106 q14-8 28 0" />
      </g>
    </svg>
  );
}
