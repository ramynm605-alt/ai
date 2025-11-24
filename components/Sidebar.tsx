
"use client";
import React, { useState, createContext, useContext, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "./icons";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Links {
  label: string;
  href?: string;
  icon: React.JSX.Element | React.ReactNode;
  onClick?: () => void;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

interface SidebarProviderProps {
  children?: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: SidebarProviderProps) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: SidebarProviderProps) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as unknown as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "h-full px-4 py-4 hidden md:flex md:flex-col bg-card border-l border-border flex-shrink-0 overflow-hidden",
        className
      )}
      initial={{ width: open ? "300px" : "80px" }}
      animate={{
        width: animate ? (open ? "300px" : "80px") : "300px",
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div
        className={cn(
          "h-16 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-card/80 backdrop-blur-md border-b border-border w-full z-[60] sticky top-0"
        )}
        {...props}
      >
        <div className="flex justify-start z-20 w-full items-center">
          <button 
            onClick={() => setOpen(!open)}
            className="p-2 rounded-lg hover:bg-secondary/80 transition-colors text-foreground"
            aria-label="Toggle Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
        
        <AnimatePresence>
          {open && (
            <>
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 z-[100] md:hidden backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                    style={{ touchAction: 'none' }}
                />
                
                {/* Sidebar Drawer */}
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{
                    duration: 0.3,
                    ease: "easeInOut",
                  }}
                  className={cn(
                    "fixed top-0 right-0 bottom-0 h-[100dvh] w-[85%] max-w-[300px] bg-card border-l border-border p-6 z-[101] flex flex-col justify-between shadow-2xl overflow-y-auto",
                    className
                  )}
                >
                  <button
                    className="absolute left-6 top-6 z-50 text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-secondary transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <X className="w-6 h-6" />
                  </button>
                  {children}
                </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const { open, animate } = useSidebar();
  return (
    <a
      href={link.href || "#"}
      onClick={(e) => {
          e.preventDefault();
          if(link.onClick) link.onClick();
      }}
      className={cn(
        "flex items-center justify-start gap-3 group/sidebar py-3 px-3 rounded-xl hover:bg-secondary transition-all duration-200 border border-transparent hover:border-border/50",
        className
      )}
      {...props}
    >
      <div className="text-muted-foreground group-hover/sidebar:text-primary transition-colors">
          {link.icon}
      </div>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-foreground text-sm font-medium whitespace-pre overflow-hidden transition-transform duration-200"
      >
        {link.label}
      </motion.span>
    </a>
  );
};