import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card elevation="lifted" padding="lg" className="w-full max-w-md text-center">
        <Badge tone="action" shape="tag" stamp className="mb-5 px-5 py-2 font-mono text-display">
          404
        </Badge>
        <h1 className="font-heading text-title font-bold">This page is off the pitch</h1>
        <p className="mt-2 text-body-sm text-muted-foreground">
          The link may be old, or the page moved. Head back and pick your path.
        </p>
        <Button size="lg" block className="mt-6 uppercase" onClick={() => navigate("/v2")}>
          Back to home
        </Button>
      </Card>
    </div>
  );
};

export default NotFound;
