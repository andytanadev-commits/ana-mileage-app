import datetime
import json
import os
import sys
import tweepy

API_KEY = os.environ.get('X_API_KEY')
API_SECRET = os.environ.get('X_API_SECRET')
ACCESS_TOKEN = os.environ.get('X_ACCESS_TOKEN')
ACCESS_TOKEN_SECRET = os.environ.get('X_ACCESS_TOKEN_SECRET')


def get_slot(utc_hour):
  jst_hour = (utc_hour + 9) % 24
  if 6 <= jst_hour < 11:
    return 'morning'
  elif 11 <= jst_hour < 17:
    return 'noon'
  else:
    return 'night'


def main():
  now_utc = datetime.datetime.now(datetime.timezone.utc)
  now_jst = now_utc + datetime.timedelta(hours=9)
  day_of_week = now_jst.strftime('%A')
  slot = get_slot(now_utc.hour)

  with open('tweets.json', 'r', encoding='utf-8') as f:
    tweets_data = json.load(f)

  tweet_text = tweets_data.get(day_of_week, {}).get(slot)
  if not tweet_text:
    print(f'ツイート文面が見つかりません: {day_of_week} {slot}')
    sys.exit(1)

  client = tweepy.Client(
      consumer_key=API_KEY,
      consumer_secret=API_SECRET,
      access_token=ACCESS_TOKEN,
      access_token_secret=ACCESS_TOKEN_SECRET,
  )

  response = client.create_tweet(text=tweet_text)
  print(f'投稿成功 [{day_of_week} {slot}]: {response.data["id"]}')


if __name__ == '__main__':
  main()