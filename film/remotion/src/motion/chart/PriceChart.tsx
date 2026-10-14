import React, {useId} from 'react';
import replay from '../data/nvda-minute-bars.json';
import {chartGeometry, clamp01, type ChartPalette, type MinuteBar} from './geometry';

export type PriceChartProps = {
  width: number;
  height: number;
  /** 0..1 reveal, supplied by caller's spoken-word cue; this component owns no clock. */
  progress?: number;
  palette: ChartPalette;
  fontFamily: string;
  bars?: readonly MinuteBar[];
  showLabels?: boolean;
  className?: string;
};

/** Real minute closes; dashed weekend connector is an annotation, never synthetic price bars. */
export const PriceChart: React.FC<PriceChartProps> = ({width, height, progress = 1, palette: c,
  fontFamily, bars = replay.bars, showLabels = true, className}) => {
  const id = useId().replace(/:/g, '');
  const g = chartGeometry(bars, width, height);
  const p = clamp01(progress);
  const endX = g.left + p * (g.right - g.left);
  const gapProgress = clamp01((endX - g.gapLeft) / (g.gapRight - g.gapLeft));
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}
    role="img" aria-label="NVDA CFD minute bars, January 24 and 27, 2025. Weekend has no observations."
    style={{fontFamily, overflow: 'visible'}}>
    <defs><clipPath id={id}><rect x={g.left - 4} y={0} width={Math.max(0, endX - g.left + 4)} height={height}/></clipPath></defs>
    <rect x={g.gapLeft} y={g.top} width={g.gapRight - g.gapLeft} height={g.bottom - g.top} fill={c.steel} opacity={.3}/>
    {g.ticks.map((v) => <g key={v}>
      <line x1={g.left} x2={g.right} y1={g.y(v)} y2={g.y(v)} stroke={c.hairline}/>
      <text x={g.left - 18} y={g.y(v) + 8} fill={c.muted} textAnchor="end" fontSize={22}>{v}</text>
    </g>)}
    <g clipPath={`url(#${id})`} fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d={g.fridayPath} stroke={c.line} strokeWidth={3.5}/>
      <path d={`M${g.gapLeft},${g.y(g.close)} L${g.gapRight},${g.y(g.open)}`}
        stroke={c.loss} strokeWidth={2.5} strokeDasharray="7 9"/>
      <path d={g.mondayPath} stroke={c.line} strokeWidth={3.5}/>
    </g>
    {showLabels && <>
      <text x={g.left} y={30} fill={c.text} fontSize={25}>NVDA · CFD / USD</text>
      <text x={g.left} y={height - 18} fill={c.muted} fontSize={22}>FRI 24 JAN · AFTERNOON</text>
      <text x={g.right} y={height - 18} textAnchor="end" fill={c.muted} fontSize={22}>MON 27 JAN</text>
      <text x={(g.gapLeft + g.gapRight) / 2} y={g.top + 38} fill={c.muted} textAnchor="middle" fontSize={20}>WEEKEND</text>
      <text x={(g.gapLeft + g.gapRight) / 2} y={g.top + 66} fill={c.muted} textAnchor="middle" fontSize={17}>NO BARS</text>
      <g opacity={p >= .4 ? 1 : 0}>
        <circle cx={g.gapLeft} cy={g.y(g.close)} r={6} fill={c.line}/>
        <text x={g.gapLeft - 14} y={g.y(g.close) - 20} fill={c.text} textAnchor="end" fontSize={28}>{g.close.toFixed(2)}</text>
      </g>
      <g opacity={gapProgress}>
        <circle cx={g.gapRight} cy={g.y(g.open)} r={6} fill={c.loss}/>
        <text x={g.gapRight + 15} y={g.y(g.open) - 25} fill={c.loss} fontSize={28}>{g.open.toFixed(2)}</text>
      </g>
    </>}
  </svg>;
};
