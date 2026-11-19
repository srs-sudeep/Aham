import { Link } from "@tanstack/react-router";
import {
  PageHeader,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Skeleton,
  Badge,
} from "@aham/ui-kit/components";
import { useTranslation } from "@aham/ui-kit";
import { useItemsQuery } from "../hooks";

export function ItemsListPage() {
  const { t } = useTranslation();
  const query = useItemsQuery();

  return (
    <div>
      <PageHeader title={t("items.title")} description={t("items.description")} />
      <Badge variant="secondary" className="mb-4">
        {t("items.mockBanner")}
      </Badge>
      <Card>
        <CardContent className="pt-6">
          {query.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {query.data && query.data.items.length === 0 ? (
            <Text variant="muted">{t("items.empty")}</Text>
          ) : null}
          {query.data && query.data.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("items.name")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link to="/items/$itemId" params={{ itemId: item.id }} className="underline">
                        {item.name}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
