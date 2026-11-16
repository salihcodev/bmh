import Svg, { Circle, G, Rect } from 'react-native-svg';

import { radii, useTheme } from '@/theme';

import { HAND, HEART, type Shape } from './geometry';
import { useTranslation } from '@/localization';

function renderShape(shape: Shape, fill: string, key: number) {
  switch (shape.kind) {
    case 'rect':
      return <Rect key={key} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} fill={fill} />;
    case 'circle':
      return <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} />;
    case 'diamond':
      return (
        <Rect
          key={key}
          x={shape.cx - shape.s / 2}
          y={shape.cy - shape.s / 2}
          width={shape.s}
          height={shape.s}
          fill={fill}
          transform={`rotate(45 ${shape.cx} ${shape.cy})`}
        />
      );
    case 'capsule': {
      const length = Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
      const angle = (Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1) * 180) / Math.PI;
      return (
        <Rect
          key={key}
          x={shape.x1 - shape.r}
          y={shape.y1 - shape.r}
          width={length + shape.r * 2}
          height={shape.r * 2}
          rx={shape.r}
          fill={fill}
          transform={`rotate(${angle} ${shape.x1} ${shape.y1})`}
        />
      );
    }
  }
}

/**
 * Be My Hand mark: an open hand with a heart in the palm. `tile` draws it on a lime
 * rounded square (app icon look); otherwise ink on transparent (lime in dark mode).
 */
export function BrandMark({
  size = 72,
  tile = false,
  on,
  color,
}: {
  size?: number;
  tile?: boolean;
  /** Color behind the mark, used for the heart cutout. */
  on?: string;
  color?: string;
}) {
  const { colors, dark } = useTheme();
  const { t } = useTranslation();
  const ink = color ?? (tile ? colors.onAccent : dark ? colors.accent : colors.textPrimary);
  const background = tile ? colors.accent : (on ?? (dark ? colors.background : colors.surface));
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityRole="image" accessibilityLabel={t('app.name')}>
      {tile ? <Rect x={0} y={0} width={100} height={100} rx={(radii.xl / 72) * 100} fill={colors.accent} /> : null}
      <G transform={tile ? 'translate(15 15) scale(0.7)' : undefined}>
        {HAND.map((shape, i) => renderShape(shape, ink, i))}
        {HEART.map((shape, i) => renderShape(shape, background, i + HAND.length))}
      </G>
    </Svg>
  );
}
