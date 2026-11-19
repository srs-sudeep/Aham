import { Settings, defineModule } from "@aham/ui-kit";
import billing from "./features/billing";
import roles from "./features/roles";
import users from "./features/users";

export default defineModule({
  id: "admin",
  labelKey: "admin.title",
  icon: Settings,
  order: 30,
  features: [users, roles, billing],
});
