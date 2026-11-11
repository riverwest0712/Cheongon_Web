import requests
import pandas as pd

# 1. API 기본 정보
url = "https://www.youthcenter.go.kr/go/ythip/getPlcy"

params = {
    "apiKeyNm": "29b26499-f479-4ff9-ac6a-f3cd799f532c",  # ← 본인 키 넣기
    "pageNum": 1,
    "pageSize": ,
    "rtnType": "json"
}

# 2. API 요청
response = requests.get(url, params=params)
data = response.json()

# 3. 정책 리스트 가져오기
policy_list = data['result']['youthPolicyList']

# 4. 필요한 데이터만 정리
rows = []
for p in policy_list:
    row = {
        "정책번호": p.get("plcyNo", ""),
        "정책명": p.get("plcyNm", ""),
        "분야": p.get("lclsfNm", ""),
        "지원내용": p.get("plcySprtCn", ""),
        "신청기간": p.get("aplyYmd", "")
    }
    rows.append(row)

# 5. 데이터프레임 생성
df = pd.DataFrame(rows)

# 7. 결과 확인
print(df)

# 8. CSV 저장
df.to_csv("전체.csv", index=False, encoding='utf-8-sig')

print("✅ 전체 CSV 저장 완료!")