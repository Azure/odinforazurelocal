# Framework Migration Guide

## From Vanilla JS to Modern Framework

This guide provides recommendations for migrating the Azure Local Network Decision Framework from vanilla JavaScript to a modern framework.

---

## Why Consider Migration?

### Current Architecture
- **Vanilla JavaScript** (ES6+)
- No build process
- Direct DOM manipulation
- Global state management
- ~5000+ lines in single file

### Benefits of Modern Framework
- ✅ Component-based architecture
- ✅ Reactive state management
- ✅ Better code organization
- ✅ Enhanced developer experience
- ✅ Testing infrastructure
- ✅ TypeScript support
- ✅ Performance optimizations

---

## Recommended Frameworks

### 1. React (Recommended)
**Best for**: Large teams, enterprise applications

**Pros**:
- Largest ecosystem
- Excellent TypeScript support
- Rich component libraries
- Strong community

**Cons**:
- Steeper learning curve
- More boilerplate
- Requires build setup

**Migration Effort**: High (2-3 weeks)

### 2. Vue.js
**Best for**: Gradual migration, balanced approach

**Pros**:
- Gentle learning curve
- Can be adopted incrementally
- Excellent documentation
- Built-in state management (Pinia)

**Cons**:
- Smaller ecosystem than React
- Less TypeScript support (improving)

**Migration Effort**: Medium (1-2 weeks)

### 3. Svelte
**Best for**: Performance-critical apps, modern approach

**Pros**:
- Minimal boilerplate
- No virtual DOM
- Smaller bundle sizes
- Built-in reactivity

**Cons**:
- Smaller community
- Fewer third-party components
- Less mature ecosystem

**Migration Effort**: Medium (1-2 weeks)

---

## Migration Strategy

### Phase 1: Preparation (1-2 days)
1. **Audit current code**
   - Identify all components/sections
   - Map state dependencies
   - Document business logic
   - List all external dependencies

2. **Set up development environment**
   - Choose framework
   - Initialize project (Vite recommended)
   - Configure TypeScript
   - Set up linting/formatting

3. **Create component hierarchy**
```
App
├── Header
│   ├── VersionInfo
│   └── ActionButtons
├── Prerequisites Banner
├── StepsContainer
│   ├── ScenarioStep
│   ├── RegionStep
│   ├── ScaleStep
│   ├── NodeStep
│   └── ...
├── SummaryPanel
│   ├── ProgressIndicator
│   ├── ConfigSummary
│   └── ActionButtons
└── Modals
    ├── CidrCalculator
    ├── CostEstimator
    ├── HelpModal
    └── ChangelogModal
```

### Phase 2: Core Infrastructure (2-3 days)
1. **State Management**
   - Choose state solution (Context API, Redux, Zustand, Pinia)
   - Define state shape
   - Implement actions/mutations
   - Add persistence layer

2. **Routing** (if needed)
   - Set up router (React Router, Vue Router)
   - Define routes
   - Implement navigation

3. **API Layer**
   - Create service modules
   - Implement localStorage wrapper
   - Add export/import logic

### Phase 3: Component Migration (5-7 days)
**Order of migration**:
1. Utilities and helpers (pure functions)
2. Simple presentational components
3. Form components
4. Complex interactive components
5. Report generation
6. ARM parameters generation

### Phase 4: Testing & Polish (3-5 days)
1. **Unit tests** for utilities
2. **Component tests** for UI
3. **Integration tests** for workflows
4. **E2E tests** for critical paths
5. **Accessibility audit**
6. **Performance optimization**

---

## Example: React Migration

### Current Vanilla JS
```javascript
// state management
const state = {
    scenario: null,
    region: null,
    // ...
};

function selectOption(category, value) {
    state[category] = value;
    updateUI();
}

function updateUI() {
    // Direct DOM manipulation
    document.querySelectorAll('.option-card').forEach(card => {
        // ...
    });
}
```

### Migrated React + TypeScript
```typescript
// types/state.ts
interface WizardState {
    scenario: string | null;
    region: string | null;
    // ...
}

// hooks/useWizardState.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useWizardState = create<WizardState>()(
    persist(
        (set) => ({
            scenario: null,
            region: null,
            selectOption: (category: string, value: string) =>
                set((state) => ({ ...state, [category]: value })),
        }),
        {
            name: 'azureLocalWizardState',
        }
    )
);

// components/ScenarioStep.tsx
import { useWizardState } from '../hooks/useWizardState';

export const ScenarioStep: React.FC = () => {
    const { scenario, selectOption } = useWizardState();
    
    return (
        <section className="step">
            <OptionCard
                value="hyperconverged"
                selected={scenario === 'hyperconverged'}
                onSelect={(value) => selectOption('scenario', value)}
                title="Hyperconverged"
                description="Compute and storage on same nodes"
            />
            {/* More options */}
        </section>
    );
};
```

---

## Project Structure (React Example)

```
src/
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── Toast.tsx
│   ├── steps/
│   │   ├── ScenarioStep.tsx
│   │   ├── RegionStep.tsx
│   │   ├── ScaleStep.tsx
│   │   └── ...
│   ├── summary/
│   │   ├── SummaryPanel.tsx
│   │   ├── ProgressIndicator.tsx
│   │   └── ConfigSummary.tsx
│   └── modals/
│       ├── CidrCalculator.tsx
│       ├── CostEstimator.tsx
│       └── HelpModal.tsx
├── hooks/
│   ├── useWizardState.ts
│   ├── useValidation.ts
│   ├── useLocalStorage.ts
│   └── useCidrCalculator.ts
├── services/
│   ├── exportService.ts
│   ├── importService.ts
│   ├── armGenerator.ts
│   └── reportGenerator.ts
├── utils/
│   ├── validation.ts
│   ├── ipCalculations.ts
│   ├── formatting.ts
│   └── sanitization.ts
├── types/
│   ├── state.ts
│   ├── config.ts
│   └── validation.ts
├── styles/
│   ├── global.css
│   ├── variables.css
│   └── animations.css
├── App.tsx
└── main.tsx
```

---

## State Management Comparison

### Current (Vanilla JS)
```javascript
const state = { /* global mutable state */ };

function updateField(key, value) {
    state[key] = value;
    saveStateToLocalStorage();
    updateUI();
}
```

### React Context
```typescript
const WizardContext = createContext<WizardState | undefined>(undefined);

export const WizardProvider: React.FC = ({ children }) => {
    const [state, dispatch] = useReducer(wizardReducer, initialState);
    
    useEffect(() => {
        localStorage.setItem('state', JSON.stringify(state));
    }, [state]);
    
    return (
        <WizardContext.Provider value={{ state, dispatch }}>
            {children}
        </WizardContext.Provider>
    );
};
```

### Zustand (Recommended)
```typescript
export const useWizardStore = create<WizardState>()(
    persist(
        (set, get) => ({
            scenario: null,
            region: null,
            
            setField: (key: string, value: any) =>
                set({ [key]: value }),
            
            reset: () => set(initialState),
            
            export: () => JSON.stringify(get()),
            
            import: (config: string) => {
                const parsed = JSON.parse(config);
                set(parsed);
            },
        }),
        {
            name: 'azureLocalWizard',
        }
    )
);
```

---

## Testing Strategy

### Unit Tests (Jest + Testing Library)
```typescript
// validation.test.ts
import { isValidNetbiosName, isValidIpv4Cidr } from './validation';

describe('isValidNetbiosName', () => {
    it('accepts valid NetBIOS names', () => {
        expect(isValidNetbiosName('SERVER01')).toBe(true);
        expect(isValidNetbiosName('Node-1')).toBe(true);
    });
    
    it('rejects invalid NetBIOS names', () => {
        expect(isValidNetbiosName('-SERVER')).toBe(false);
        expect(isValidNetbiosName('AAAAAAAAAAAAAAAA')).toBe(false);
    });
});
```

### Component Tests
```typescript
// ScenarioStep.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenarioStep } from './ScenarioStep';

describe('ScenarioStep', () => {
    it('renders all scenario options', () => {
        render(<ScenarioStep />);
        expect(screen.getByText('Hyperconverged')).toBeInTheDocument();
        expect(screen.getByText('Disaggregated')).toBeInTheDocument();
    });
    
    it('updates state when option selected', () => {
        const { getByText } = render(<ScenarioStep />);
        fireEvent.click(getByText('Hyperconverged'));
        // Assert state change
    });
});
```

---

## Performance Considerations

### Code Splitting
```typescript
// Lazy load heavy components
const ReportGenerator = lazy(() => import('./components/ReportGenerator'));
const ArmGenerator = lazy(() => import('./components/ArmGenerator'));

<Suspense fallback={<Loading />}>
    <ReportGenerator />
</Suspense>
```

### Memoization
```typescript
const MemoizedDiagram = React.memo(NetworkDiagram, (prev, next) => {
    return prev.nodes === next.nodes && prev.scenario === next.scenario;
});
```

### Virtual Scrolling
```typescript
// For large node lists
import { FixedSizeList } from 'react-window';

<FixedSizeList
    height={600}
    itemCount={nodeSettings.length}
    itemSize={80}
>
    {NodeRow}
</FixedSizeList>
```

---

## Migration Checklist

### Pre-Migration
- [ ] Document current functionality
- [ ] Create comprehensive test suite
- [ ] Backup current version
- [ ] Set up new repository/branch
- [ ] Choose framework
- [ ] Set up build tooling

### During Migration
- [ ] Migrate utilities first
- [ ] Build component library
- [ ] Implement state management
- [ ] Port business logic
- [ ] Add tests incrementally
- [ ] Maintain feature parity

### Post-Migration
- [ ] Performance testing
- [ ] Accessibility audit
- [ ] Browser compatibility testing
- [ ] User acceptance testing
- [ ] Documentation updates
- [ ] Deployment pipeline

---

## Recommended Tools

### Build & Dev
- **Vite**: Fast build tool and dev server
- **TypeScript**: Type safety
- **ESLint**: Code linting
- **Prettier**: Code formatting

### Testing
- **Vitest**: Unit testing (Vite-native)
- **Testing Library**: Component testing
- **Playwright**: E2E testing

### State Management
- **Zustand**: Simple, TypeScript-first
- **Redux Toolkit**: If complex state needs
- **TanStack Query**: Server state management

### UI Components
- **Radix UI**: Unstyled, accessible primitives
- **Headless UI**: Unstyled components
- **shadcn/ui**: Re-usable components

---

## Cost-Benefit Analysis

### Costs
- **Development Time**: 2-4 weeks
- **Testing**: 1 week
- **Learning Curve**: Varies by team
- **Bundle Size**: Likely larger initially

### Benefits
- **Maintainability**: Much improved
- **Scalability**: Better for growth
- **Developer Experience**: Significantly better
- **Testing**: Easier to test
- **Type Safety**: Catch errors early
- **Performance**: Potential improvements

---

## Decision: Migrate or Stay?

### Stay with Vanilla JS if:
- ✅ Application is stable and rarely changes
- ✅ Team prefers simplicity
- ✅ No plans for significant growth
- ✅ Performance is already excellent

### Migrate to Framework if:
- ✅ Frequent updates planned
- ✅ Team comfortable with modern tools
- ✅ Want better maintainability
- ✅ Need improved testing
- ✅ Planning new features

---

## Conclusion

Migration to a modern framework is **recommended** for this project given:
- Growing complexity (5000+ lines)
- New features being added
- Need for better testing
- State management complexity

**Recommended Path**: React + TypeScript + Zustand + Vite

This provides the best balance of:
- Ecosystem support
- Developer experience
- Performance
- Future-proofing

---

## Resources

- [React Documentation](https://react.dev/)
- [Vue.js Guide](https://vuejs.org/guide/)
- [Svelte Tutorial](https://svelte.dev/tutorial)
- [Zustand Guide](https://github.com/pmndrs/zustand)
- [Vite Documentation](https://vitejs.dev/)
- [Testing Library](https://testing-library.com/)
