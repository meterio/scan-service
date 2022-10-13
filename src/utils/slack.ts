import axios from 'axios';

export const postToSlackChannel = async (msg: any) => {
  try {
    const res = await axios.post(
      'https://hooks.slack.com/services/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',
      msg
    );
    console.log(res);
    console.log('successfully posted to slack channel');
  } catch (e) {
    console.log('ERROR in posting to slack channel');
  }
};
