import { IS_EXPO_GO } from '../runtime';
import { ProofBrushSession } from './ProofBrushSession';

type Props = { onDone: () => void; onCancel?: () => void };

// Loaded lazily: importing the camera/AI libraries crashes inside Expo Go.
const NativeBrushSession: (props: Props) => React.JSX.Element | null = IS_EXPO_GO
  ? () => null
  : require('./NativeBrushSession').NativeBrushSession;

/** Expo Go: hands-free timer with photo proof. Dev/production builds: camera AI. */
export function BrushScreen(props: Props) {
  return IS_EXPO_GO ? <ProofBrushSession {...props} /> : <NativeBrushSession {...props} />;
}
