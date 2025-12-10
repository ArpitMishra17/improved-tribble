import { useState, useEffect } from "react";
import { HelpCircle, Play, RefreshCw, Check, ChevronRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useTour } from "@/components/TourProvider";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function TourLauncher() {
  const { user } = useAuth();
  const {
    isRunning,
    startTour,
    stopTour,
    resetTours,
    availableTours,
    completedTours,
    hasSeenFirstVisitTour,
    dismissFirstVisitTour,
  } = useTour();

  const [showWelcomePrompt, setShowWelcomePrompt] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Show welcome prompt for first-time users
  useEffect(() => {
    if (!hasSeenFirstVisitTour) {
      const timer = setTimeout(() => {
        setShowWelcomePrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [hasSeenFirstVisitTour]);

  const handleStartFullTour = () => {
    setShowWelcomePrompt(false);
    dismissFirstVisitTour();
    startTour();
  };

  const handleDismissWelcome = () => {
    setShowWelcomePrompt(false);
    dismissFirstVisitTour();
  };

  const handleStartSpecificTour = (tourId: string) => {
    setIsMenuOpen(false);
    startTour(tourId);
  };

  const completedCount = completedTours.length;
  const totalTours = availableTours.length;

  // Don't show tour launcher for unauthenticated users
  if (!user) {
    return null;
  }

  // Hide launcher when tour is running
  if (isRunning) {
    return null;
  }

  // Don't show if no tours available for this role
  if (availableTours.length === 0) {
    return null;
  }

  return (
    <>
      {/* Welcome Prompt for First-Time Users */}
      {showWelcomePrompt && (
        <div className="fixed bottom-20 right-6 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-[#1e1e2e] border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-500/20 p-5 max-w-sm">
            <button
              onClick={handleDismissWelcome}
              className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base mb-1">
                  Welcome to VantaHire!
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Take a quick tour to learn how to make the most of your recruitment dashboard.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleStartFullTour}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Play className="h-3 w-3 mr-1.5" />
                    Start Tour
                  </Button>
                  <Button
                    onClick={handleDismissWelcome}
                    size="sm"
                    variant="ghost"
                    className="text-gray-400 hover:text-white hover:bg-white/10"
                  >
                    Maybe Later
                  </Button>
                </div>
              </div>
            </div>
          </div>
          {/* Arrow pointer */}
          <div className="absolute -bottom-2 right-8 w-4 h-4 bg-[#1e1e2e] border-r border-b border-purple-500/30 transform rotate-45" />
        </div>
      )}

      {/* Persistent Guide Button */}
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn(
              "fixed bottom-6 right-6 z-[9998] rounded-full w-12 h-12 p-0 shadow-lg transition-all duration-300",
              "bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600",
              "border border-purple-400/30 hover:border-purple-400/50",
              "hover:scale-110 hover:shadow-purple-500/30 hover:shadow-xl"
            )}
            aria-label="Open help guide"
          >
            <HelpCircle className="h-5 w-5 text-white" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          alignOffset={-8}
          sideOffset={12}
          className="w-72 bg-[#1e1e2e] border-purple-500/30 text-white"
        >
          <DropdownMenuLabel className="flex items-center justify-between py-3 px-4">
            <span className="text-base font-semibold">Help & Tours</span>
            <span className="text-xs text-gray-400">
              {completedCount}/{totalTours} completed
            </span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="bg-purple-500/20" />

          {/* Full Tour Option */}
          <DropdownMenuItem
            onClick={handleStartFullTour}
            className="py-3 px-4 cursor-pointer hover:bg-purple-500/20 focus:bg-purple-500/20"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <Play className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">Full Platform Tour</div>
                <div className="text-xs text-gray-400">
                  Complete walkthrough of all features
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-500" />
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-purple-500/20" />

          <DropdownMenuLabel className="py-2 px-4 text-xs text-gray-400 uppercase tracking-wide">
            Quick Tours
          </DropdownMenuLabel>

          {/* Individual Tour Options */}
          {availableTours.map((tour) => {
            const isCompleted = completedTours.includes(tour.id);
            return (
              <DropdownMenuItem
                key={tour.id}
                onClick={() => handleStartSpecificTour(tour.id)}
                className="py-2.5 px-4 cursor-pointer hover:bg-purple-500/20 focus:bg-purple-500/20"
              >
                <div className="flex items-center gap-3 w-full">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
                      isCompleted
                        ? "bg-green-500/20 text-green-400"
                        : "bg-purple-500/20 text-purple-400"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{tour.title}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {tour.description}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator className="bg-purple-500/20" />

          {/* Reset Tours Option */}
          <DropdownMenuItem
            onClick={resetTours}
            className="py-2.5 px-4 cursor-pointer hover:bg-purple-500/20 focus:bg-purple-500/20 text-gray-400"
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm">Reset All Tours</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
