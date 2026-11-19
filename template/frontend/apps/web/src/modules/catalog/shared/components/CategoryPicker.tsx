import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useTranslation,
} from "@aham/ui-kit";
import { useCategoryOptions } from "../hooks/use-category-options";

const NONE = "__none__";

export function CategoryPicker({
  value,
  onChange,
  id,
  disabled,
  invalid,
  describedBy,
}: {
  /** Selected category id; empty string / undefined means "no category". */
  value?: string;
  onChange: (categoryId: string) => void;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const { t } = useTranslation();
  const query = useCategoryOptions();

  return (
    <Select
      value={value || NONE}
      onValueChange={(next) => onChange(next === NONE ? "" : next)}
      disabled={disabled || query.isLoading}
    >
      <SelectTrigger id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
        <SelectValue placeholder={t("catalog.categoryPicker.placeholder")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("catalog.categoryPicker.none")}</SelectItem>
        {(query.data ?? []).map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
