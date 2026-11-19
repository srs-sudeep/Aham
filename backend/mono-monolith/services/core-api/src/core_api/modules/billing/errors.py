from platform_kit.errors import NotFoundError


class PlanNotFoundError(NotFoundError):
    code = "plan_not_found"
    message = "Plan not found."


class SubscriptionNotFoundError(NotFoundError):
    code = "subscription_not_found"
    message = "Subscription not found."
