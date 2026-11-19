import { Link } from "@tanstack/react-router";
import { PageHeader, Card, CardContent, Text, Skeleton } from "@aham/ui-kit/components";
import { useTranslation } from "@aham/ui-kit";
import { useItemQuery } from "../hooks";

export function ItemDetailPage({ itemId }: { itemId: string }) {
  const { t } = useTranslation();
  const query = useItemQuery(itemId);

  return (
    <div>
      <PageHeader
        title={t("items.detail")}
        actions={
          <Link to="/items" className="inline-flex h-10 items-center rounded-md border border-input px-4 text-body">
            {t("items.back")}
          </Link>
        }
      />
      <Card>
        <CardContent className="space-y-2 pt-6">
          {query.isLoading ? <Skeleton className="h-8 w-1/2" /> : null}
          {query.data ? (
            <>
              <Text variant="label">{t("items.name")}</Text>
              <Text>{query.data.name}</Text>
              {query.data.description ? <Text variant="muted">{query.data.description}</Text> : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
