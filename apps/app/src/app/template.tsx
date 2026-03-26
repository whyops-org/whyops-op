'use client';

import { useAuthStore } from "@/stores/authStore";
import { useEffect } from "react";

type Props = {
    children: React.ReactNode;
}

const Template = (props: Props) => {
  const loadSession = useAuthStore((state) => state.loadSession);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);
  
  const {children} = props;

  return (
    <>
        {children}
    </>
  )
}

export default Template