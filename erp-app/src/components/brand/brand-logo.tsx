import { Image } from 'react-native';

const logo = require('../../../assets/images/gabfix-logo.png');

type Props = {
  size?: number;
};

/** Circular Gabfix mark, copied from the client app so the portal reads as the same product. */
export function BrandLogo({ size = 56 }: Props) {
  return (
    <Image
      source={logo}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="Gabfix Home Solutions logo"
      accessible
    />
  );
}
