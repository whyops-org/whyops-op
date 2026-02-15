"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOutIcon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

export type DropdownOption = {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
};

type UserDropdownProps = {
  userEmail?: string;
  options?: DropdownOption[];
};

export function UserDropdown({ userEmail, options = [] }: UserDropdownProps) {
  const router = useRouter();
  const signOut = useAuthStore((state) => state.signOut);

  const handleLogout = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="rounded-full px-0 bg-primary/20 text-primary hover:bg-primary/30 h-9 w-9"
          aria-label="User profile"
        >
          <UserIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {userEmail && (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Account</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {userEmail}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {options.length > 0 ? (
          options.map((option, index) => (
            <DropdownMenuItem
              key={index}
              onClick={option.onClick}
              className="cursor-pointer"
            >
              {option.icon && <span className="mr-2">{option.icon}</span>}
              {option.label}
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer"
          >
            <LogOutIcon className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 13C3 10.7909 5.01472 9 7.5 9H8.5C10.9853 9 13 10.7909 13 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
