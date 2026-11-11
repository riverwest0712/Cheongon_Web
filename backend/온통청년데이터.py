import requests

url = "https://www.youthcenter.go.kr/go/ythip/getPlcy"

params = {
    "apiKeyNm": "29b26499-f479-4ff9-ac6a-f3cd799f532c",
    "pageNum": 1,
    "pageSize": 10,
    "rtnType": "json"
}

response = requests.get(url, params=params)

data = response.json()

print(data)