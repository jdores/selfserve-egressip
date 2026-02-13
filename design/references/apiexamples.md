Let's fix the issues with the API logic by looking at these examples below:

This is an example of the API to get items from a zero trust list (I am removing the auth headers):
curl --location 'https://api.cloudflare.com/client/v4/accounts/<account_id>/gateway/lists/67a93ec7-9970-4c87-a537-a7ce6ec70277/items' \
--header 'Content-Type: application/json' \

Response:
{
    "result": [
        {
            "value": "miguel@jdores.xyz",
            "created_at": "2026-02-13T16:05:25Z"
        }
    ],
    "success": true,
    "errors": [],
    "messages": [],
    "result_info": {
        "page": 1,
        "per_page": 50,
        "count": 1,
        "total_count": 1,
        "total_pages": 1
    }
}

This is an example of the API to remove a user from a zero trust list (I am removing the auth headers):
curl --location --request PATCH 'https://api.cloudflare.com/client/v4/accounts/<account_id>/gateway/lists/67a93ec7-9970-4c87-a537-a7ce6ec70277' \
--header 'Content-Type: application/json' \
--data-raw '{
  "remove": [
    "miguel@jdores.xyz"
  ]
}'

Response:
{
    "result": {
        "id": "67a93ec7-9970-4c87-a537-a7ce6ec70277",
        "name": "self-serve-egressip-jp",
        "description": "",
        "type": "EMAIL",
        "created_at": "2026-02-13T10:31:21Z",
        "updated_at": "2026-02-13T16:40:07Z"
    },
    "success": true,
    "errors": [],
    "messages": []
}

This is an example of the API to add a user to a zero trust list (I am removing the auth headers):
curl --location --request PATCH 'https://api.cloudflare.com/client/v4/accounts/<account_id>/gateway/lists/67a93ec7-9970-4c87-a537-a7ce6ec70277' \
--header 'Content-Type: application/json' \
--data-raw '{
  "append": [
    {
      "value": "jose@jdores.xyz"
    }
  ]
}'

Response:
{
    "result": {
        "id": "67a93ec7-9970-4c87-a537-a7ce6ec70277",
        "name": "self-serve-egressip-jp",
        "description": "",
        "type": "EMAIL",
        "created_at": "2026-02-13T10:31:21Z",
        "updated_at": "2026-02-13T16:43:54Z",
        "count": 1
    },
    "success": true,
    "errors": [],
    "messages": []
}

Now I will add an extra user to the list (it already contains jose@jdores.xyz):
curl --location --request PATCH 'https://api.cloudflare.com/client/v4/accounts/<account_id>/gateway/lists/67a93ec7-9970-4c87-a537-a7ce6ec70277' \
--header 'Content-Type: application/json' \
--data-raw '{
  "append": [
    {
      "value": "miguel@jdores.xyz"
    }
  ]
}'

Response:
{
    "result": {
        "id": "67a93ec7-9970-4c87-a537-a7ce6ec70277",
        "name": "self-serve-egressip-jp",
        "description": "",
        "type": "EMAIL",
        "created_at": "2026-02-13T10:31:21Z",
        "updated_at": "2026-02-13T16:45:52Z",
        "count": 2
    },
    "success": true,
    "errors": [],
    "messages": []
}

State of the list:
curl --location 'https://api.cloudflare.com/client/v4/accounts/<account_id>/gateway/lists/67a93ec7-9970-4c87-a537-a7ce6ec70277/items' \
--header 'Content-Type: application/json' \

Response:
{
    "result": [
        {
            "value": "jose@jdores.xyz",
            "created_at": "2026-02-13T16:43:54Z"
        },
        {
            "value": "miguel@jdores.xyz",
            "created_at": "2026-02-13T16:45:52Z"
        }
    ],
    "success": true,
    "errors": [],
    "messages": [],
    "result_info": {
        "page": 1,
        "per_page": 50,
        "count": 2,
        "total_count": 2,
        "total_pages": 1
    }
}

And now remove a user from the list:
curl --location --request PATCH 'https://api.cloudflare.com/client/v4/accounts/<account_id>/gateway/lists/67a93ec7-9970-4c87-a537-a7ce6ec70277' \
--header 'Content-Type: application/json' \
--data-raw '{
  "remove": [
    "jose@jdores.xyz"
  ]
}'

Response:
{
    "result": {
        "id": "67a93ec7-9970-4c87-a537-a7ce6ec70277",
        "name": "self-serve-egressip-jp",
        "description": "",
        "type": "EMAIL",
        "created_at": "2026-02-13T10:31:21Z",
        "updated_at": "2026-02-13T16:47:30Z",
        "count": 1
    },
    "success": true,
    "errors": [],
    "messages": []
}

State of the list after removal:
curl --location 'https://api.cloudflare.com/client/v4/accounts/<account_id>/gateway/lists/67a93ec7-9970-4c87-a537-a7ce6ec70277/items' \
--header 'Content-Type: application/json' \

Response:
{
    "result": [
        {
            "value": "miguel@jdores.xyz",
            "created_at": "2026-02-13T16:45:52Z"
        }
    ],
    "success": true,
    "errors": [],
    "messages": [],
    "result_info": {
        "page": 1,
        "per_page": 50,
        "count": 1,
        "total_count": 1,
        "total_pages": 1
    }
}