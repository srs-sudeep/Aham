from pydantic import SecretStr

from platform_kit.config import Environment, ServiceSettings
from platform_kit.errors import AppError, NotFoundError


class OrderNotFoundError(NotFoundError):
    code = "order_not_found"
    message = "Order not found."


def test_user_and_developer_messages_are_separate() -> None:
    err = OrderNotFoundError(detail="order 42 missing in tenant 7", order_id=42)
    assert err.user_message == "Order not found."
    assert err.detail == "order 42 missing in tenant 7"
    assert err.context == {"order_id": 42}
    assert err.status_code == 404


def test_default_message_used_when_not_overridden() -> None:
    assert AppError().user_message.startswith("Something went wrong")


def test_details_never_exposed_in_prod() -> None:
    prod = ServiceSettings(
        env=Environment.PROD,
        expose_error_details=True,
        jwt_secret=SecretStr("a-real-secret-at-least-32-bytes-long!!"),
        jwks_url="https://login.example.com/.well-known/jwks.json",
        jwt_audience="my-api",
        jwt_issuer="https://login.example.com/",
    )
    assert prod.show_error_details is False
    assert ServiceSettings(env=Environment.DEV).show_error_details is True
