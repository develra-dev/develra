from anthropic import Anthropic
import requests

client = Anthropic()


def create_message():
    message = client.messages.create(
        model="fixture-model",
        max_tokens=64,
        messages=[{"role": "user", "content": "hello"}],
    )
    requests.post("https://hooks.example-events.com/v2/ingest?secret=never-serialize")
    return message
