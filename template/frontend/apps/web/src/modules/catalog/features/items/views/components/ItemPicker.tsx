import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useTranslation,
} from "@aham/ui-kit";
import { useItemOptions } from "../../hooks/use-items";

/** Item select for other modules (exposed through `catalog/public.ts`). */
export function ItemPicker({
  value,
  onChange,
  id,
  disabled,
  placeholder,
}: {
  value?: string;
  onChange: (itemId: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const query = useItemOptions();

  return (
    <Select
      value={value || undefined}
      onValueChange={onChange}
      disabled={disabled || query.isLoading}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder ?? t("catalog.itemPicker.placeholder")} />
      </SelectTrigger>
      <SelectContent>
        {(query.data ?? []).map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
