# FaithFlow UI Components

## Design System

Our UI components are built on top of Tailwind CSS and shadcn/ui, following a consistent design system inspired by Stripe's clean and modern aesthetic.

### Core Components

#### 1. Button
```tsx
// @/components/ui/button.tsx
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
	'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/90',
				destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
				outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
				secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
				ghost: 'hover:bg-accent hover:text-accent-foreground',
				link: 'underline-offset-4 hover:underline text-primary',
			},
			size: {
				default: 'h-10 py-2 px-4',
				sm: 'h-9 px-3 rounded-md',
				lg: 'h-11 px-8 rounded-md',
				icon: 'h-10 w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);
```

Usage:
```tsx
<Button variant="default" size="lg">
	Create Event
</Button>

<Button variant="outline" size="sm">
	Cancel
</Button>
```

#### 2. Input
```tsx
// @/components/ui/input.tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	error?: string;
	label?: string;
	helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, error, label, helperText, type, ...props }, ref) => {
		return (
			<div className="space-y-2">
				{label && (
					<Label htmlFor={props.id} className="text-sm font-medium">
						{label}
					</Label>
				)}
				<input
					type={type}
					className={cn(
						"flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
						error && "border-red-500 focus-visible:ring-red-500",
						className
					)}
					ref={ref}
					{...props}
				/>
				{error && <p className="text-sm text-red-500">{error}</p>}
				{helperText && <p className="text-sm text-gray-500">{helperText}</p>}
			</div>
		);
	}
);
```

Usage:
```tsx
<Input
	label="Email Address"
	type="email"
	placeholder="you@example.com"
	helperText="We'll never share your email."
/>

<Input
	label="Password"
	type="password"
	error="Password must be at least 8 characters"
/>
```

#### 3. Card
```tsx
// @/components/ui/card.tsx
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(
				"rounded-lg border bg-card text-card-foreground shadow-sm",
				className
			)}
			{...props}
		/>
	)
);

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn("flex flex-col space-y-1.5 p-6", className)}
			{...props}
		/>
	)
);

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
	({ className, ...props }, ref) => (
		<h3
			ref={ref}
			className={cn("text-lg font-semibold leading-none tracking-tight", className)}
			{...props}
		/>
	)
);
```

Usage:
```tsx
<Card>
	<CardHeader>
		<CardTitle>Recent Donations</CardTitle>
	</CardHeader>
	<CardContent>
		<DonationsList />
	</CardContent>
	<CardFooter>
		<Button>View All</Button>
	</CardFooter>
</Card>
```

#### 4. Form
```tsx
// @/components/ui/form.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

interface FormProps<T extends z.ZodType> {
	schema: T;
	onSubmit: (data: z.infer<T>) => void;
	children: React.ReactNode;
}

export function Form<T extends z.ZodType>({ schema, onSubmit, children }: FormProps<T>) {
	const form = useForm({
		resolver: zodResolver(schema),
	});

	return (
		<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
			{children}
		</form>
	);
}
```

Usage:
```tsx
const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

<Form schema={loginSchema} onSubmit={handleLogin}>
	<Input name="email" label="Email" />
	<Input name="password" type="password" label="Password" />
	<Button type="submit">Login</Button>
</Form>
```

### Layout Components

#### 1. Page Layout
```tsx
// @/components/layout/page.tsx
interface PageProps {
	title: string;
	description?: string;
	children: React.ReactNode;
}

export function Page({ title, description, children }: PageProps) {
	return (
		<div className="container mx-auto px-4 py-8">
			<header className="mb-8">
				<h1 className="text-3xl font-bold">{title}</h1>
				{description && (
					<p className="mt-2 text-gray-600">{description}</p>
				)}
			</header>
			<main>{children}</main>
		</div>
	);
}
```

#### 2. Dashboard Layout
```tsx
// @/components/layout/dashboard.tsx
interface DashboardProps {
	sidebar: React.ReactNode;
	header: React.ReactNode;
	children: React.ReactNode;
}

export function Dashboard({ sidebar, header, children }: DashboardProps) {
	return (
		<div className="min-h-screen bg-gray-100">
			<div className="flex">
				<aside className="w-64 min-h-screen bg-white border-r">
					{sidebar}
				</aside>
				<main className="flex-1">
					<header className="h-16 bg-white border-b">
						{header}
					</header>
					<div className="p-6">
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}
```

### Data Display Components

#### 1. Table
```tsx
// @/components/ui/table.tsx
interface TableProps<T> {
	data: T[];
	columns: {
		header: string;
		accessor: keyof T;
		cell?: (value: T[keyof T]) => React.ReactNode;
	}[];
}

export function Table<T>({ data, columns }: TableProps<T>) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b">
						{columns.map((column) => (
							<th key={String(column.accessor)} className="px-4 py-3 text-left">
								{column.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{data.map((row, i) => (
						<tr key={i} className="border-b">
							{columns.map((column) => (
								<td key={String(column.accessor)} className="px-4 py-3">
									{column.cell
										? column.cell(row[column.accessor])
										: String(row[column.accessor])}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
```

#### 2. Stats Card
```tsx
// @/components/ui/stats-card.tsx
interface StatsCardProps {
	title: string;
	value: string | number;
	change?: number;
	icon?: React.ReactNode;
}

export function StatsCard({ title, value, change, icon }: StatsCardProps) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				{icon}
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold">{value}</div>
				{change && (
					<p className={cn(
						"text-xs",
						change > 0 ? "text-green-500" : "text-red-500"
					)}>
						{change > 0 ? "+" : ""}{change}%
					</p>
				)}
			</CardContent>
		</Card>
	);
}
```

### Feedback Components

#### 1. Toast
```tsx
// @/components/ui/toast.tsx
import { toast } from 'sonner';

export const showToast = {
	success: (message: string) => toast.success(message),
	error: (message: string) => toast.error(message),
	loading: (message: string) => toast.loading(message),
};
```

#### 2. Dialog
```tsx
// @/components/ui/dialog.tsx
interface DialogProps {
	open: boolean;
	onClose: () => void;
	title: string;
	description?: string;
	children: React.ReactNode;
}

export function Dialog({ open, onClose, title, description, children }: DialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onClose}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					{description && (
						<AlertDialogDescription>{description}</AlertDialogDescription>
					)}
				</AlertDialogHeader>
				{children}
			</AlertDialogContent>
		</AlertDialog>
	);
}
```

### Theme Configuration

```typescript
// tailwind.config.js
module.exports = {
	darkMode: ["class"],
	content: ["./src/**/*.{ts,tsx}"],
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {
			colors: {
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
		},
	},
};
```

### Usage Guidelines

1. Component Organization
- Keep components small and focused
- Use composition over inheritance
- Follow atomic design principles
- Maintain consistent naming

2. Accessibility
- Use semantic HTML
- Include ARIA labels
- Support keyboard navigation
- Test with screen readers

3. Performance
- Lazy load components
- Optimize images
- Minimize re-renders
- Use proper memoization

4. Testing
- Write unit tests
- Include integration tests
- Test accessibility
- Test responsiveness