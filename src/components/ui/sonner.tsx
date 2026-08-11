/* eslint-disable react-refresh/only-export-components */
import { Toaster as Sonner, toast } from "sonner";
import { getStoredTheme } from "@/lib/theme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// App themes: "light" | "dark" | "night". Sonner only supports light/dark/system.
const THEME_MAP: Record<string, ToasterProps["theme"]> = {
  light: "light",
  dark: "dark",
  night: "dark",
};

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = THEME_MAP[getStoredTheme()] || "system";

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
