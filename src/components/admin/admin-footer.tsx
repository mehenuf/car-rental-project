export function AdminFooter() {
  return (
    <footer className="border-t border-border bg-card px-(--space-sm) py-(--space-sm) text-sm text-muted-foreground">
      <p>&copy; {new Date().getFullYear()} BestCar. All rights reserved.</p>
    </footer>
  );
}
