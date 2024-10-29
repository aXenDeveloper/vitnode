import { HslColor } from '@/helpers/colors';
import { HslColorPicker } from 'react-colorful';

export const ContentColor = ({
  color,
  setColor,
}: {
  color: HslColor | null;
  setColor: (color: string) => void;
}) => {
  return (
    <div className="flex flex-col gap-5">
      <HslColorPicker
        color={
          color ?? {
            h: 0,
            s: 0,
            l: 0,
          }
        }
        onChange={color => {
          setColor(`hsl(${color.h}, ${color.s}%, ${color.l}%)`);
        }}
      />
    </div>
  );
};
