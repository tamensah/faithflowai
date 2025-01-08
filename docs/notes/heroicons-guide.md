# Best Practices for Using Heroicons in React/Next.js

This guide outlines the recommended approaches for implementing Heroicons in a React/Next.js application.

## Direct Import Method (Recommended)

The simplest and most straightforward approach is to import icons directly from the package:

```typescript
'use client';

import { HomeIcon, UserIcon } from '@heroicons/react/24/outline';
// or for solid icons
import { HomeIcon, UserIcon } from '@heroicons/react/24/solid';

function MyComponent() {
  return (
    <div>
      <HomeIcon className="h-6 w-6 text-gray-500" />
      <UserIcon className="h-6 w-6 text-gray-500" />
    </div>
  );
}
```

## Centralized Icons File

If you need to manage icons in a central location, create an icons index file:

```typescript
// src/components/icons/index.ts
'use client';

import {
  HomeIcon,
  UserIcon,
  // ... other icons
} from '@heroicons/react/24/outline';

export {
  HomeIcon,
  UserIcon,
  // ... other icons
};
```

## Dynamic Icon Component

For cases where you need to render icons dynamically:

```typescript
'use client';

import { HomeIcon, UserIcon } from '@heroicons/react/24/outline';

const ICON_MAP = {
  home: HomeIcon,
  user: UserIcon,
} as const;

type IconName = keyof typeof ICON_MAP;

interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className = "h-6 w-6" }: IconProps) {
  const IconComponent = ICON_MAP[name];
  return <IconComponent className={className} aria-hidden="true" />;
}
```

Usage:
```typescript
function Navigation() {
  return (
    <nav>
      <Icon name="home" className="h-5 w-5 text-gray-500" />
      <Icon name="user" className="h-5 w-5 text-gray-500" />
    </nav>
  );
}
```

## Best Practices

### 1. Import Paths
Use the correct import path based on your needs:
```typescript
import { Icon } from '@heroicons/react/24/outline';  // For outline icons
import { Icon } from '@heroicons/react/24/solid';    // For solid icons
```

### 2. Dimensions
Always specify dimensions using Tailwind classes or CSS:
```typescript
<HomeIcon className="h-6 w-6" />
```

### 3. Accessibility
Add appropriate accessibility attributes:

For decorative icons:
```typescript
<HomeIcon className="h-6 w-6" aria-hidden="true" />
```

For semantic icons:
```typescript
<button>
  <HomeIcon className="h-6 w-6" />
  <span className="sr-only">Home</span>
</button>
```

### 4. Styling
Use Tailwind utilities for consistent styling:

```typescript
// Size
<HomeIcon className="h-6 w-6" />

// Color
<HomeIcon className="h-6 w-6 text-gray-500 hover:text-gray-700" />

// Responsive
<HomeIcon className="h-4 w-4 md:h-6 md:w-6" />
```

### 5. Next.js Client Components
Remember to add the 'use client' directive when using icons in client components:

```typescript
'use client';

import { HomeIcon } from '@heroicons/react/24/outline';
```

## Common Pitfalls to Avoid

1. Don't create wrapper components for individual icons unless necessary
2. Avoid inline styles for icons
3. Don't forget accessibility attributes
4. Don't use complex re-export patterns that might break tree-shaking
5. Avoid dynamically importing icons unless absolutely necessary

## Performance Considerations

1. Use consistent import paths to help with tree-shaking
2. Keep icon components pure to prevent unnecessary re-renders
3. Consider lazy loading for rarely-used icons in large applications

## TypeScript Integration

Ensure proper TypeScript setup:

```typescript
// For icon components
type IconProps = React.ComponentProps<typeof HomeIcon>;

// For dynamic icons
type IconName = keyof typeof ICON_MAP;
```

This guide covers the fundamental best practices for implementing Heroicons in your React/Next.js application. Follow these patterns to maintain clean, accessible, and performant icon usage throughout your project.