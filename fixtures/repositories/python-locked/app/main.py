from anthropic import Anthropic

client = Anthropic()


def create_message():
    return client.messages.create(
        model="fixture-model",
        max_tokens=64,
        messages=[{"role": "user", "content": "hello"}],
    )
