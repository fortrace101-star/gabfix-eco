import type { ReactNode } from 'react';

import type { Capability } from '@/lib/capabilities';
import { useCapabilities } from '@/store/auth';

type RequireCapabilityProps = {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Hides UI a role cannot use. The database policy is still the real gate —
 * this only keeps unusable buttons off the screen.
 */
export function RequireCapability({ capability, children, fallback = null }: RequireCapabilityProps) {
  const { can } = useCapabilities();
  return can(capability) ? children : fallback;
}
