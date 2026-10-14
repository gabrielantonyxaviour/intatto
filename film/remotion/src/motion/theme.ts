import {Easing} from 'remotion';
import {loadFont as loadDisplay} from '@remotion/google-fonts/InstrumentSerif';
import {loadFont as loadBody} from '@remotion/google-fonts/IBMPlexSans';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';

/** Shared Intatto film tokens from MOTION_BRIEF.md. No product look is modified. */
export const fonts = {
  display: loadDisplay('normal', {weights: ['400'], subsets: ['latin']}).fontFamily,
  body: loadBody('normal', {weights: ['400', '500', '600'], subsets: ['latin']}).fontFamily,
  mono: loadMono('normal', {weights: ['400', '500'], subsets: ['latin']}).fontFamily,
} as const;
export const colors = {
  background: '#0A0F1C', panel: '#111A2E', hairline: 'rgba(255,255,255,0.08)',
  amber: '#F2B544', amberGlow: '#FFD27A', extended: 'rgba(242,181,68,0.35)',
  steel: '#2B3850', steelLight: '#3E4C66', steelText: '#8FA0BA',
  text: '#E8EDF5', muted: '#8A96AA', loss: '#FF5D5D', pass: '#38D39F', replay: '#7FA6FF',
} as const;
export const spacing = {safeX: 120, safeY: 100, gap: 32, panelPadding: 40} as const;
export const type = {display: 112, displaySmall: 96, body: 44, data: 32, label: 22} as const;
export const easeOutExpo = Easing.bezier(.16, 1, .3, 1);
export const easeInOutCubic = Easing.inOut(Easing.cubic);
export const easing = {easeOutExpo, easeInOutCubic, entranceFrames: 22, settle: {damping: 200}} as const;
export type LabelKind = 'LIVE' | 'SANDBOX' | 'REPLAY' | 'SYNTHETIC';
export const labels: Record<LabelKind, {color: string; borderColor: string}> = {
  LIVE: {color: colors.pass, borderColor: colors.pass},
  SANDBOX: {color: colors.amber, borderColor: colors.amber},
  REPLAY: {color: colors.replay, borderColor: colors.replay},
  SYNTHETIC: {color: colors.loss, borderColor: colors.loss},
};
export const theme = {colors, fonts, spacing, type, easing, labels} as const;
