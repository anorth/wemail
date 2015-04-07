#!/bin/sh

# TODO(alex): Extend maxage a lot once development slows
# TODO(alex): Deploy gzipped files too after we have a build process

export AWS_DEFAULT_REGION=us-west-1

CREDENTIALS_FILE="aws-credentials.sh"
BUCKET="s3://mailcoup.com"
CACHE_CONTROL="public, max-age=120, s-maxage=120"

if [ -f ${CREDENTIALS_FILE} ]
then
  echo "Loading credientials " ${CREDENTIALS_FILE}
  source ${CREDENTIALS_FILE}
else
  echo "Can't find" ${CREDENTIALS_FILE}
fi

aws s3 sync src ${BUCKET} --cache-control "${CACHE_CONTROL}"

echo "Done"
