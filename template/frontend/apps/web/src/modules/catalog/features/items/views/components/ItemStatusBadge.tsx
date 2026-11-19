import { Badge, useTranslation } from "@aham/ui-kit";
import { ITEM_STATUS_BADGE_VARIANT, type ItemStatus } from "../../model/item.constants";

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const { t } = useTranslation();
  return <Badge variant={ITEM_STATUS_BADGE_VARIANT[status]}>{t(`items.status.${status}`)}</Badge>;
}
