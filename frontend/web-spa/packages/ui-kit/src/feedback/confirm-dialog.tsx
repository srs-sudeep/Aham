import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Button } from "../primitives/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../primitives/dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(next) => (loading ? undefined : onOpenChange(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogPrimitive.Description className="text-muted text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t("common.cancel", "Cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={loading}
            onClick={() => void onConfirm()}
          >
            {confirmLabel ?? t("common.confirm", "Confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
