import { useEffect } from "react";
import { useLocation } from "wouter";

export default function DemoPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/recruiter-auth");
  }, [setLocation]);

  return null;
}
